'use client';

import WebTorrent from 'webtorrent';

export class WebTorrentManager {
  private client: WebTorrent.Instance | null = null;
  private currentTorrent: WebTorrent.Torrent | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.client = new WebTorrent();
    }
  }

  async seedFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('WebTorrent client not initialized'));
        return;
      }

      this.client.seed(file, (torrent) => {
        this.currentTorrent = torrent;
        console.log('Seeding torrent:', torrent.magnetURI);
        resolve(torrent.magnetURI);
      });
    });
  }

  async downloadFile(
    magnetURI: string,
    onProgress?: (progress: number) => void,
    onComplete?: (file: File) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('WebTorrent client not initialized'));
        return;
      }

      const torrent = this.client.add(magnetURI, (torrent) => {
        console.log('Downloading torrent:', torrent.name);
        this.currentTorrent = torrent;
      });

      torrent.on('download', () => {
        if (onProgress) {
          onProgress(torrent.progress * 100);
        }
      });

      torrent.on('done', () => {
        console.log('Download complete!');
        const file = torrent.files[0];
        if (file) {
          file.getBlob((err, blob) => {
            if (err) {
              if (onError) onError(err);
              reject(err);
              return;
            }
            const downloadedFile = new File([blob!], file.name, {
              type: blob!.type,
            });
            if (onComplete) onComplete(downloadedFile);
            resolve();
          });
        }
      });

      torrent.on('error', (err) => {
        console.error('Torrent error:', err);
        if (onError) onError(err);
        reject(err);
      });
    });
  }

  getProgress(): number {
    return this.currentTorrent ? this.currentTorrent.progress * 100 : 0;
  }

  getUploadSpeed(): number {
    return this.currentTorrent ? this.currentTorrent.uploadSpeed : 0;
  }

  getDownloadSpeed(): number {
    return this.currentTorrent ? this.currentTorrent.downloadSpeed : 0;
  }

  getNumPeers(): number {
    return this.currentTorrent ? this.currentTorrent.numPeers : 0;
  }

  destroy() {
    if (this.currentTorrent) {
      this.currentTorrent.destroy();
    }
    if (this.client) {
      this.client.destroy();
    }
  }
}

