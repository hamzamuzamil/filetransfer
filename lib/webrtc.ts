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
      if (isHost) {
        // Host creates a new peer connection
        this.peer = new Peer({
          host: '0.peerjs.com',
          port: 443,
          path: '/',
          secure: true,
        });

        this.peer.on('open', (id) => {
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
        this.peer = new Peer({
          host: '0.peerjs.com',
          port: 443,
          path: '/',
          secure: true,
        });

        this.peer.on('open', () => {
          console.log('Client: Peer opened, connecting to host...');
          const conn = this.peer!.connect(connectionId, {
            reliable: true,
          });

          this.setupDataChannel(conn);
          resolve(connectionId);
        });

        this.peer.on('error', (error) => {
          console.error('Peer error:', error);
          reject(error);
        });
      }
    });
  }

  private connectionReadyCallbacks: (() => void)[] = [];

  private setupDataChannel(conn: any) {
    this.dataChannel = conn;
    
    // Check if already open
    if (conn.open) {
      console.log('Data channel already open');
      this.connectionReadyCallbacks.forEach(cb => cb());
    } else {
      console.log('Data channel not open yet, waiting for open event...');
    }
    
    conn.on('open', () => {
      console.log('Data channel opened - connection ready!');
      this.connectionReadyCallbacks.forEach(cb => cb());
    });

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
    });

    conn.on('close', () => {
      if (this.dataChannel === conn) {
        this.dataChannel = null;
      }
      console.log('Connection closed');
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
    // PeerJS DataConnection uses 'open' property (boolean)
    // Native RTCDataChannel uses readyState === 'open'
    try {
      if (typeof this.dataChannel.open === 'boolean') {
        return this.dataChannel.open === true;
      }
      if (this.dataChannel.readyState) {
        return this.dataChannel.readyState === 'open';
      }
      // Fallback: check if we can access the connection
      return !!this.dataChannel;
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
          reject(new Error('Connection timeout: Waiting for recipient to connect. Please make sure the recipient has opened the share link and both browsers are on the same network or have proper NAT traversal.'));
        }
      }, 500); // Check every 500ms
    });
  }
}

