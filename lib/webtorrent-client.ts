import WebTorrent from 'webtorrent';

export interface TorrentProgress {
  progress: number;
  downloaded: number;
  total: number;
  downloadSpeed: number;
  uploadSpeed: number;
  peers: number;
  timeRemaining: number;
}

export interface EncryptedFile {
  data: ArrayBuffer;
  name: string;
  type: string;
  size: number;
}

export class WebTorrentClient {
  private client: WebTorrent.Instance | null = null;
  private currentTorrent: WebTorrent.Torrent | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.client = new WebTorrent({
        tracker: {
          rtcConfig: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:global.stun.twilio.com:3478' }
            ]
          }
        }
      });
    }
  }

  // Simple XOR encryption for password protection
  private encryptData(data: Uint8Array, password: string): Uint8Array {
    if (!password) return data;
    
    const key = new TextEncoder().encode(password);
    const encrypted = new Uint8Array(data.length);
    
    for (let i = 0; i < data.length; i++) {
      encrypted[i] = data[i] ^ key[i % key.length];
    }
    
    return encrypted;
  }

  private decryptData(data: Uint8Array, password: string): Uint8Array {
    // XOR is symmetric, so decryption is the same as encryption
    return this.encryptData(data, password);
  }

  async seedFile(
    file: File,
    password: string,
    onProgress: (progress: TorrentProgress) => void,
    onReady: (magnetURI: string) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    if (!this.client) {
      onError(new Error('WebTorrent not initialized'));
      return;
    }

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Encrypt if password provided
      const encryptedData = password ? this.encryptData(uint8Array, password) : uint8Array;

      // Create a new File/Blob with encrypted data
      const encryptedFile = new File(
        [encryptedData.buffer as ArrayBuffer],
        password ? `${file.name}.encrypted` : file.name,
        { type: file.type }
      );

      // Seed the file with public trackers
      this.currentTorrent = this.client.seed(encryptedFile, {
        announceList: [
          ['wss://tracker.openwebtorrent.com'],
          ['wss://tracker.webtorrent.dev'],
          ['wss://tracker.btorrent.xyz']
        ]
      }, (torrent) => {
        const magnetURI = torrent.magnetURI;
        
        // Add metadata for decryption
        const fullMagnetURI = password 
          ? `${magnetURI}&x.originalName=${encodeURIComponent(file.name)}&x.originalType=${encodeURIComponent(file.type)}&x.encrypted=true`
          : magnetURI;

        console.log('Torrent ready:', fullMagnetURI);
        onReady(fullMagnetURI);

        // Progress updates
        const interval = setInterval(() => {
          if (!torrent) {
            clearInterval(interval);
            return;
          }

          onProgress({
            progress: torrent.progress,
            downloaded: torrent.downloaded,
            total: torrent.length,
            downloadSpeed: torrent.downloadSpeed,
            uploadSpeed: torrent.uploadSpeed,
            peers: torrent.numPeers,
            timeRemaining: torrent.timeRemaining,
          });
        }, 1000);
      });

      this.currentTorrent.on('error', (err) => {
        onError(err instanceof Error ? err : new Error(String(err)));
      });
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  async downloadFile(
    magnetURI: string,
    password: string,
    onProgress: (progress: TorrentProgress) => void,
    onComplete: (file: Blob, filename: string) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    if (!this.client) {
      onError(new Error('WebTorrent not initialized'));
      return;
    }

    try {
      // Parse magnet URI to check for encryption
      const url = new URL(magnetURI);
      const isEncrypted = url.searchParams.get('x.encrypted') === 'true';
      const originalName = url.searchParams.get('x.originalName') || 'download';
      const originalType = url.searchParams.get('x.originalType') || 'application/octet-stream';

      this.currentTorrent = this.client.add(magnetURI, (torrent) => {
        const file = torrent.files[0];

        // Progress updates
        const interval = setInterval(() => {
          if (!torrent) {
            clearInterval(interval);
            return;
          }

          onProgress({
            progress: torrent.progress,
            downloaded: torrent.downloaded,
            total: torrent.length,
            downloadSpeed: torrent.downloadSpeed,
            uploadSpeed: torrent.uploadSpeed,
            peers: torrent.numPeers,
            timeRemaining: torrent.timeRemaining,
          });
        }, 1000);

        file.getBlob((err, blob) => {
          clearInterval(interval);
          
          if (err) {
            onError(err instanceof Error ? err : new Error(String(err)));
            return;
          }

          if (!blob) {
            onError(new Error('Failed to get file blob'));
            return;
          }

          // Decrypt if needed
          if (isEncrypted) {
            blob.arrayBuffer().then((arrayBuffer) => {
              const uint8Array = new Uint8Array(arrayBuffer);
              const decrypted = this.decryptData(uint8Array, password);
              const decryptedBlob = new Blob([decrypted.buffer as ArrayBuffer], { type: originalType });
              onComplete(decryptedBlob, originalName);
            }).catch((error) => {
              onError(error instanceof Error ? error : new Error(String(error)));
            });
          } else {
            onComplete(blob, originalName);
          }
        });
      });

      this.currentTorrent.on('error', (err) => {
        onError(err instanceof Error ? err : new Error(String(err)));
      });
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  stopSeeding() {
    if (this.currentTorrent) {
      this.currentTorrent.destroy();
      this.currentTorrent = null;
    }
  }

  destroy() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
  }
}

