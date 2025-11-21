import { WebRTCManager } from './webrtc';
import { FileMetadata, TransferProgress, FileChunk } from '@/types';

const CHUNK_SIZE = 64 * 1024; // 64KB chunks for optimal performance

export class FileTransferManager {
  private webrtc: WebRTCManager;
  private onProgress?: (progress: TransferProgress) => void;
  private onComplete?: () => void;
  private onError?: (error: Error) => void;

  constructor(webrtc: WebRTCManager) {
    this.webrtc = webrtc;
  }

  setCallbacks(
    onProgress?: (progress: TransferProgress) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void
  ) {
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onError = onError;
  }

  async sendFiles(files: File[]): Promise<void> {
    try {
      // Connection should already be established before calling sendFiles
      // Just verify it's ready
      if (!this.webrtc.isConnected()) {
        throw new Error('Connection not ready. Please wait for recipient to connect.');
      }

      // Send metadata first
      const metadata: { files: FileMetadata[] } = {
        files: files.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
        })),
      };

      const metadataStr = JSON.stringify(metadata);
      const metadataBuffer = new TextEncoder().encode(metadataStr);
      const metadataLength = new Uint32Array([metadataBuffer.length]);
      
      // Send metadata length (4 bytes) + metadata
      await this.webrtc.sendChunk(metadataLength.buffer);
      await this.webrtc.sendChunk(metadataBuffer.buffer);

      let totalBytesTransferred = 0;
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      const startTime = Date.now();

      // Send each file
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, file.size);
          const chunk = file.slice(start, end);

          const chunkBuffer = await chunk.arrayBuffer();
          
          // Create chunk header: fileIndex (4 bytes) + chunkIndex (4 bytes) + totalChunks (4 bytes) + chunkSize (4 bytes)
          const header = new ArrayBuffer(16);
          const headerView = new DataView(header);
          headerView.setUint32(0, fileIndex, true);
          headerView.setUint32(4, chunkIndex, true);
          headerView.setUint32(8, totalChunks, true);
          headerView.setUint32(12, chunkBuffer.byteLength, true);

          // Send header + chunk
          await this.webrtc.sendChunk(header);
          await this.webrtc.sendChunk(chunkBuffer);

          totalBytesTransferred += chunkBuffer.byteLength;

          // Calculate progress
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = totalBytesTransferred / elapsed;
          const remaining = totalBytes - totalBytesTransferred;
          const timeRemaining = remaining / speed;

          if (this.onProgress) {
            this.onProgress({
              bytesTransferred: totalBytesTransferred,
              totalBytes,
              percentage: (totalBytesTransferred / totalBytes) * 100,
              speed,
              timeRemaining: isFinite(timeRemaining) ? timeRemaining : 0,
            });
          }
        }
      }

      if (this.onComplete) {
        this.onComplete();
      }
    } catch (error) {
      if (this.onError) {
        this.onError(error as Error);
      }
      throw error;
    }
  }

  async receiveFiles(
    onFileReceived: (files: File[]) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let metadataBuffer: Uint8Array | null = null;
      let metadataLength: number | null = null;
      let receivedMetadataLength = false;
      let metadataBytesReceived = 0;

      const files: { name: string; size: number; type: string; chunks: ArrayBuffer[] }[] = [];
      let currentFileIndex = -1;
      let currentChunkIndex = 0;
      let currentTotalChunks = 0;
      let totalBytesReceived = 0;
      let totalBytes = 0;
      const startTime = Date.now();

      this.webrtc.onChunk((chunk: ArrayBuffer) => {
        try {
          if (!receivedMetadataLength) {
            // First 4 bytes are metadata length
            if (chunk.byteLength === 4) {
              metadataLength = new DataView(chunk).getUint32(0, true);
              metadataBuffer = new Uint8Array(metadataLength);
              receivedMetadataLength = true;
              return;
            }
          }

          if (metadataLength && metadataBuffer && metadataBytesReceived < metadataLength) {
            // Receiving metadata
            const remaining = metadataLength - metadataBytesReceived;
            const toCopy = Math.min(remaining, chunk.byteLength);
            metadataBuffer.set(new Uint8Array(chunk.slice(0, toCopy)), metadataBytesReceived);
            metadataBytesReceived += toCopy;

            if (metadataBytesReceived === metadataLength) {
              // Parse metadata
              const metadataStr = new TextDecoder().decode(metadataBuffer);
              const metadata = JSON.parse(metadataStr) as { files: FileMetadata[] };
              
              totalBytes = metadata.files.reduce((sum, f) => sum + f.size, 0);
              
              metadata.files.forEach(file => {
                files.push({
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  chunks: [],
                });
              });
            }
            return;
          }

          // Receiving file chunks
          if (chunk.byteLength === 16) {
            // This is a chunk header
            const view = new DataView(chunk);
            const fileIndex = view.getUint32(0, true);
            const chunkIndex = view.getUint32(4, true);
            const totalChunks = view.getUint32(8, true);
            const chunkSize = view.getUint32(12, true);

            currentFileIndex = fileIndex;
            currentChunkIndex = chunkIndex;
            currentTotalChunks = totalChunks;

            // Initialize file if needed
            if (!files[fileIndex]) {
              files[fileIndex] = {
                name: `file-${fileIndex}`,
                size: 0,
                type: 'application/octet-stream',
                chunks: [],
              };
            }

            // Prepare for chunk data
            return;
          }

          // This is chunk data
          if (currentFileIndex >= 0 && files[currentFileIndex]) {
            files[currentFileIndex].chunks.push(chunk);
            totalBytesReceived += chunk.byteLength;

            // Update progress
            if (this.onProgress) {
              const elapsed = (Date.now() - startTime) / 1000;
              const speed = totalBytesReceived / elapsed;
              const remaining = totalBytes - totalBytesReceived;
              const timeRemaining = remaining / speed;

              this.onProgress({
                bytesTransferred: totalBytesReceived,
                totalBytes,
                percentage: (totalBytesReceived / totalBytes) * 100,
                speed,
                timeRemaining: isFinite(timeRemaining) ? timeRemaining : 0,
              });
            }

            // Check if all chunks received for this file
            if (files[currentFileIndex].chunks.length === currentTotalChunks) {
              // Reconstruct file
              const fileMetadata = files[currentFileIndex];
              const blob = new Blob(fileMetadata.chunks, { type: fileMetadata.type });
              const file = new File([blob], fileMetadata.name, {
                type: fileMetadata.type,
                lastModified: Date.now(),
              });

              // Check if all files are complete
              const allComplete = files.every((f, idx) => {
                if (idx === currentFileIndex) return true;
                return f.chunks.length > 0;
              });

              if (allComplete && files.length > 0) {
                // Reconstruct all files
                const receivedFiles = files.map((f, idx) => {
                  const blob = new Blob(f.chunks, { type: f.type });
                  return new File([blob], f.name, {
                    type: f.type,
                    lastModified: Date.now(),
                  });
                });

                onFileReceived(receivedFiles);
                
                if (this.onComplete) {
                  this.onComplete();
                }
                resolve();
              }
            }
          }
        } catch (error) {
          if (this.onError) {
            this.onError(error as Error);
          }
          reject(error);
        }
      });
    });
  }

  cancel() {
    this.webrtc.disconnect();
  }
}

