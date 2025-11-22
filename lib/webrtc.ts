import Peer from 'peerjs';

export class WebRTCManager {
  private peer: Peer | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private connectionId: string | null = null;
  private isHost: boolean = false;
  private chunkCallbacks: ((chunk: ArrayBuffer) => void)[] = [];

  async initialize(isHost: boolean = false, connectionId?: string): Promise<string> {
    this.isHost = isHost;
    
    return new Promise((resolve, reject) => {
      const peerConfig = {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ],
          iceTransportPolicy: 'all',
          iceCandidatePoolSize: 10
        },
        debug: 0
      };

      if (isHost) {
        // Host creates a new peer connection
        this.peer = new Peer(peerConfig);

        this.peer.on('open', (id) => {
          console.log('Host: Peer opened with ID:', id);
          this.connectionId = id;
          resolve(id);
        });

        this.peer.on('error', (error) => {
          console.error('Peer error:', error);
          reject(error);
        });

        this.peer.on('connection', (conn) => {
          console.log('Host: Received connection from client');
          this.setupDataChannel(conn);
        });
      } else {
        // Client connects to host
        if (!connectionId) {
          reject(new Error('Connection ID required for client'));
          return;
        }

        this.connectionId = connectionId;
        this.peer = new Peer(peerConfig);

        this.peer.on('open', () => {
          console.log('Client: Peer opened, connecting to host:', connectionId);
          
          const conn = this.peer!.connect(connectionId, {
            reliable: true,
            serialization: 'binary'
          });

          // Handle connection errors
          conn.on('error', (err: any) => {
            console.error('Connection error:', err);
            reject(new Error('Failed to connect to sender. The sender may be offline or the link may be invalid.'));
          });

          this.setupDataChannel(conn);
          resolve(connectionId);
        });

        this.peer.on('error', (error: any) => {
          console.error('Peer error:', error);
          // Provide helpful error messages based on error type
          if (error.type === 'peer-unavailable') {
            reject(new Error('Sender is not available. Please ensure the sender has opened their browser and is waiting with the share link page open.'));
          } else if (error.type === 'network') {
            reject(new Error('Network error. Please check your internet connection.'));
          } else {
            reject(new Error('Connection failed: ' + (error.message || 'Unknown error')));
          }
        });
      }
    });
  }

  private connectionReadyCallbacks: (() => void)[] = [];

  private setupDataChannel(conn: any) {
    this.dataChannel = conn;
    
    // Set binary data type for better performance
    if (conn.dataChannel && conn.dataChannel.binaryType) {
      conn.dataChannel.binaryType = 'arraybuffer';
    }
    
    // Track if connection ever succeeds
    let connectionEstablished = false;
    
    // Check if already open
    if (conn.open) {
      console.log('Data channel already open');
      connectionEstablished = true;
      this.connectionReadyCallbacks.forEach(cb => cb());
      this.connectionReadyCallbacks = [];
    } else {
      console.log('Data channel not open yet, waiting for open event...');
      
      // Add timeout for connection
      const timeout = setTimeout(() => {
        if (!conn.open && !connectionEstablished) {
          console.error('Data channel connection timeout - peer may not exist');
          conn.close();
        }
      }, 15000); // 15 seconds timeout
      
      conn.on('open', () => {
        clearTimeout(timeout);
        connectionEstablished = true;
        console.log('Data channel opened - connection ready!');
        this.connectionReadyCallbacks.forEach(cb => cb());
        this.connectionReadyCallbacks = [];
      });
    }

    conn.on('data', (data: any) => {
      // Convert to ArrayBuffer if needed
      let buffer: ArrayBuffer;
      if (data instanceof ArrayBuffer) {
        buffer = data;
      } else if (data instanceof Blob) {
        // Handle blob - convert to arraybuffer asynchronously
        data.arrayBuffer().then(ab => {
          this.chunkCallbacks.forEach(cb => cb(ab));
        });
        return;
      } else if (data instanceof Uint8Array) {
        buffer = data.buffer as ArrayBuffer;
      } else {
        // Try to convert
        buffer = data;
      }
      this.chunkCallbacks.forEach(cb => cb(buffer));
    });

    conn.on('error', (error: Error) => {
      console.error('Connection error:', error);
      if (!connectionEstablished) {
        console.error('Failed to establish connection - peer may be offline');
      }
    });

    conn.on('close', () => {
      if (this.dataChannel === conn) {
        this.dataChannel = null;
      }
      if (!connectionEstablished) {
        console.error('Connection closed before establishing - sender is not available');
        // This will be caught by the timeout in setupDataChannel
      } else {
        console.log('Connection closed gracefully');
      }
    });
  }

  sendChunk(chunk: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.dataChannel) {
        reject(new Error('Data channel not initialized'));
        return;
      }

      // Check connection state using readyState
      const isOpen = this.dataChannel.readyState === 'open';
      
      if (!isOpen) {
        reject(new Error('Data channel not ready. Please wait for recipient to connect.'));
        return;
      }

      try {
        this.dataChannel.send(chunk);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  onChunk(callback: (chunk: ArrayBuffer) => void) {
    this.chunkCallbacks.push(callback);
  }

  onConnectionChange(callback: (connected: boolean) => void) {
    if (this.dataChannel) {
      const checkConnection = () => {
        callback(this.dataChannel?.readyState === 'open');
      };
      
      this.dataChannel.addEventListener('open', checkConnection);
      this.dataChannel.addEventListener('close', checkConnection);
      checkConnection();
    }
  }

  disconnect() {
    this.chunkCallbacks = [];
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }

  getConnectionId(): string | null {
    return this.connectionId;
  }

  isConnected(): boolean {
    if (!this.dataChannel) return false;
    // RTCDataChannel uses readyState === 'open'
    try {
      return this.dataChannel.readyState === 'open';
    } catch (e) {
      return false;
    }
  }

  async waitForConnection(timeout: number = 60000): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already connected
      if (this.isConnected()) {
        console.log('Already connected');
        resolve();
        return;
      }

      // If no data channel exists yet, wait a bit for it to be created
      if (!this.dataChannel && this.isHost) {
        // Host is waiting for connection, so data channel doesn't exist yet
        console.log('Host: Waiting for recipient to connect...');
      } else if (!this.dataChannel && !this.isHost) {
        // Client should have data channel by now
        console.log('Client: Data channel not created yet');
      }

      const startTime = Date.now();
      let resolved = false;
      
      // Add callback for when connection opens
      const onReady = () => {
        if (resolved) return;
        resolved = true;
        clearInterval(checkInterval);
        const index = this.connectionReadyCallbacks.indexOf(onReady);
        if (index > -1) {
          this.connectionReadyCallbacks.splice(index, 1);
        }
        console.log('Connection ready via callback');
        resolve();
      };
      this.connectionReadyCallbacks.push(onReady);

      // Also poll for connection state
      const checkInterval = setInterval(() => {
        if (resolved) return;
        
        if (this.isConnected()) {
          resolved = true;
          const index = this.connectionReadyCallbacks.indexOf(onReady);
          if (index > -1) {
            this.connectionReadyCallbacks.splice(index, 1);
          }
          clearInterval(checkInterval);
          console.log('Connection ready via polling');
          resolve();
        } else if (Date.now() - startTime > timeout) {
          resolved = true;
          const index = this.connectionReadyCallbacks.indexOf(onReady);
          if (index > -1) {
            this.connectionReadyCallbacks.splice(index, 1);
          }
          clearInterval(checkInterval);
          reject(new Error('Connection timeout. Please ensure both parties have opened their browsers and the link is correct.'));
        }
      }, 250); // Check every 250ms for faster connection detection
    });
  }
}

