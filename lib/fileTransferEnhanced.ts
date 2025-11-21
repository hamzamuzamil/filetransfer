import { WebRTCManager } from './webrtc';
import { FileMetadata, TransferProgress, FileChunk } from '@/types';
import { EncryptionManager } from './encryption';
import { StorageManager, TransferStateData } from './storage';

const CHUNK_SIZE = 256 * 1024; // 256KB chunks for better performance with large files
const MAX_MEMORY_CHUNKS = 50; // Maximum chunks to keep in memory (12.8 MB)

export interface EnhancedFileMetadata extends FileMetadata {
  encrypted: boolean;
  salt?: string;
  iv?: string;
}

export class FileTransferManagerEnhanced {
  private webrtc: WebRTCManager;
  private storage: StorageManager;
  private onProgress?: (progress: TransferProgress) => void;
  private onComplete?: () => void;
  private onError?: (error: Error) => void;
  private transferId: string;
  private password?: string;
  private isPaused: boolean = false;
  private abortController?: AbortController;

  constructor(webrtc: WebRTCManager, transferId: string) {
    this.webrtc = webrtc;
    this.storage = new StorageManager();
    this.transferId = transferId;
  }

  async initialize(): Promise<void> {
    await this.storage.init();
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

  setPassword(password: string) {
    this.password = password;
  }

  pause() {
    this.isPaused = true;
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  resume() {
    this.isPaused = false;
  }

  async sendFiles(files: File[], resumeFrom?: TransferStateData): Promise<void> {
    try {
      await this.initialize();

      if (!this.webrtc.isConnected()) {
        throw new Error('Connection not ready. Please wait for recipient to connect.');
      }

      this.abortController = new AbortController();

      // Create password verifier if password is set
      let passwordVerifier;
      if (this.password) {
        passwordVerifier = await EncryptionManager.createPasswordVerifier(this.password);
      }

      // Prepare metadata
      const metadata: {
        files: EnhancedFileMetadata[];
        passwordProtected: boolean;
        passwordVerifier?: any;
      } = {
        files: files.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          encrypted: !!this.password,
        })),
        passwordProtected: !!this.password,
        passwordVerifier,
      };

      // Send metadata
      const metadataStr = JSON.stringify(metadata);
      const metadataBuffer = new TextEncoder().encode(metadataStr);
      const metadataLength = new Uint32Array([metadataBuffer.length]);
      
      await this.webrtc.sendChunk(metadataLength.buffer);
      await this.webrtc.sendChunk(metadataBuffer.buffer);

      let totalBytesTransferred = resumeFrom?.progress.bytesTransferred || 0;
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
      const startTime = Date.now();

      // Track sent chunks for resume capability
      const receivedChunks = resumeFrom?.receivedChunks || {};

      // Send each file
      for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const file = files[fileIndex];
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

        if (!receivedChunks[fileIndex]) {
          receivedChunks[fileIndex] = {};
        }

        // Use streaming for large files to manage memory better
        const fileStream = file.stream();
        const reader = fileStream.getReader();
        
        let chunkIndex = 0;
        let remainingBytes = file.size;
        
        // Memory management: keep track of chunks in memory
        const chunkBuffer: ArrayBuffer[] = [];

        while (remainingBytes > 0 && !this.isPaused) {
          // Skip already sent chunks
          if (receivedChunks[fileIndex][chunkIndex]) {
            const skipSize = Math.min(CHUNK_SIZE, remainingBytes);
            remainingBytes -= skipSize;
            chunkIndex++;
            continue;
          }

          // Read chunk from stream
          const chunkSize = Math.min(CHUNK_SIZE, remainingBytes);
          const chunkData = await this.readChunkFromStream(reader, chunkSize);
          
          let chunkBuffer = chunkData;

          // Encrypt if password is set
          if (this.password) {
            const encrypted = await EncryptionManager.encrypt(chunkData, this.password);
            
            // Combine salt, iv, and encrypted data
            const combined = new Uint8Array(
              encrypted.salt.byteLength + 
              encrypted.iv.byteLength + 
              encrypted.encrypted.byteLength + 
              8 // 4 bytes for salt length, 4 bytes for IV length
            );
            
            const view = new DataView(combined.buffer);
            view.setUint32(0, encrypted.salt.byteLength, true);
            view.setUint32(4, encrypted.iv.byteLength, true);
            
            let offset = 8;
            combined.set(new Uint8Array(encrypted.salt), offset);
            offset += encrypted.salt.byteLength;
            combined.set(new Uint8Array(encrypted.iv), offset);
            offset += encrypted.iv.byteLength;
            combined.set(new Uint8Array(encrypted.encrypted), offset);
            
            chunkBuffer = combined.buffer;
          }

          // Create chunk header
          const header = new ArrayBuffer(16);
          const headerView = new DataView(header);
          headerView.setUint32(0, fileIndex, true);
          headerView.setUint32(4, chunkIndex, true);
          headerView.setUint32(8, totalChunks, true);
          headerView.setUint32(12, chunkBuffer.byteLength, true);

          // Send header + chunk
          await this.webrtc.sendChunk(header);
          await this.webrtc.sendChunk(chunkBuffer);

          // Mark as sent
          receivedChunks[fileIndex][chunkIndex] = true;
          
          // Save to storage for resume capability
          await this.storage.saveChunk(this.transferId, fileIndex, chunkIndex, chunkBuffer);

          totalBytesTransferred += chunkSize;
          remainingBytes -= chunkSize;

          // Calculate and report progress
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

          // Save transfer state periodically for resume
          if (chunkIndex % 10 === 0) {
            await this.saveTransferState({
              id: this.transferId,
              type: 'sender',
              files: files.map(f => ({
                name: f.name,
                size: f.size,
                type: f.type,
                lastModified: f.lastModified,
              })),
              progress: {
                bytesTransferred: totalBytesTransferred,
                totalBytes,
                percentage: (totalBytesTransferred / totalBytes) * 100,
              },
              receivedChunks,
              timestamp: Date.now(),
              expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
            });
          }

          chunkIndex++;

          // Memory management: clear old chunks
          if (chunkIndex > MAX_MEMORY_CHUNKS) {
            // Force garbage collection hint
            if (globalThis.gc) {
              globalThis.gc();
            }
          }
        }

        reader.releaseLock();

        if (this.isPaused) {
          throw new Error('Transfer paused by user');
        }
      }

      // Clean up storage after successful transfer
      await this.storage.deleteTransferState(this.transferId);

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
    onFileReceived: (files: File[]) => void,
    resumeFrom?: TransferStateData
  ): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      let metadataBuffer: Uint8Array | null = null;
      let metadataLength: number | null = null;
      let receivedMetadataLength = false;
      let metadataBytesReceived = 0;
      let passwordVerifier: any = null;
      let passwordValidated = false;

      const files: {
        name: string;
        size: number;
        type: string;
        encrypted: boolean;
        chunks: ArrayBuffer[];
        receivedChunks: Set<number>;
      }[] = [];
      
      let currentFileIndex = -1;
      let currentChunkIndex = 0;
      let currentTotalChunks = 0;
      let totalBytesReceived = resumeFrom?.progress.bytesTransferred || 0;
      let totalBytes = 0;
      const startTime = Date.now();

      // Load previously received chunks
      const previousChunks = resumeFrom?.receivedChunks || {};

      this.webrtc.onChunk(async (chunk: ArrayBuffer) => {
        try {
          if (!receivedMetadataLength) {
            if (chunk.byteLength === 4) {
              metadataLength = new DataView(chunk).getUint32(0, true);
              metadataBuffer = new Uint8Array(metadataLength);
              receivedMetadataLength = true;
              return;
            }
          }

          if (metadataLength && metadataBuffer && metadataBytesReceived < metadataLength) {
            const remaining = metadataLength - metadataBytesReceived;
            const toCopy = Math.min(remaining, chunk.byteLength);
            metadataBuffer.set(new Uint8Array(chunk.slice(0, toCopy)), metadataBytesReceived);
            metadataBytesReceived += toCopy;

            if (metadataBytesReceived === metadataLength) {
              const metadataStr = new TextDecoder().decode(metadataBuffer);
              const metadata = JSON.parse(metadataStr) as {
                files: EnhancedFileMetadata[];
                passwordProtected: boolean;
                passwordVerifier?: any;
              };
              
              totalBytes = metadata.files.reduce((sum, f) => sum + f.size, 0);
              
              if (metadata.passwordProtected && metadata.passwordVerifier) {
                passwordVerifier = metadata.passwordVerifier;
                // Password validation will happen when password is provided
              }
              
              metadata.files.forEach(file => {
                files.push({
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  encrypted: file.encrypted || false,
                  chunks: [],
                  receivedChunks: new Set(),
                });
              });
            }
            return;
          }

          // Check password if needed
          if (passwordVerifier && !passwordValidated && !this.password) {
            if (this.onError) {
              this.onError(new Error('PASSWORD_REQUIRED'));
            }
            return;
          }

          if (chunk.byteLength === 16) {
            // Chunk header
            const view = new DataView(chunk);
            const fileIndex = view.getUint32(0, true);
            const chunkIndex = view.getUint32(4, true);
            const totalChunks = view.getUint32(8, true);

            currentFileIndex = fileIndex;
            currentChunkIndex = chunkIndex;
            currentTotalChunks = totalChunks;

            if (!files[fileIndex]) {
              files[fileIndex] = {
                name: `file-${fileIndex}`,
                size: 0,
                type: 'application/octet-stream',
                encrypted: false,
                chunks: [],
                receivedChunks: new Set(),
              };
            }

            return;
          }

          // Chunk data
          if (currentFileIndex >= 0 && files[currentFileIndex]) {
            // Skip if already received
            if (files[currentFileIndex].receivedChunks.has(currentChunkIndex)) {
              return;
            }

            let chunkData = chunk;

            // Decrypt if encrypted
            if (files[currentFileIndex].encrypted && this.password) {
              try {
                const view = new DataView(chunk);
                const saltLength = view.getUint32(0, true);
                const ivLength = view.getUint32(4, true);
                
                let offset = 8;
                const salt = new Uint8Array(chunk.slice(offset, offset + saltLength));
                offset += saltLength;
                const iv = new Uint8Array(chunk.slice(offset, offset + ivLength));
                offset += ivLength;
                const encrypted = chunk.slice(offset);
                
                chunkData = await EncryptionManager.decrypt(encrypted, this.password, salt, iv);
              } catch (error) {
                if (this.onError) {
                  this.onError(new Error('Failed to decrypt chunk. Invalid password?'));
                }
                reject(error);
                return;
              }
            }

            files[currentFileIndex].chunks.push(chunkData);
            files[currentFileIndex].receivedChunks.add(currentChunkIndex);
            totalBytesReceived += chunkData.byteLength;

            // Save chunk for resume capability
            await this.storage.saveChunk(
              this.transferId,
              currentFileIndex,
              currentChunkIndex,
              chunkData
            );

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

            // Save transfer state periodically
            if (currentChunkIndex % 10 === 0) {
              const receivedChunksMap: any = {};
              files.forEach((f, idx) => {
                receivedChunksMap[idx] = {};
                f.receivedChunks.forEach(chunkIdx => {
                  receivedChunksMap[idx][chunkIdx] = true;
                });
              });

              await this.saveTransferState({
                id: this.transferId,
                type: 'receiver',
                files: files.map(f => ({
                  name: f.name,
                  size: f.size,
                  type: f.type,
                  lastModified: Date.now(),
                })),
                progress: {
                  bytesTransferred: totalBytesReceived,
                  totalBytes,
                  percentage: (totalBytesReceived / totalBytes) * 100,
                },
                receivedChunks: receivedChunksMap,
                timestamp: Date.now(),
                expiresAt: Date.now() + 24 * 60 * 60 * 1000,
              });
            }

            // Check if file is complete
            if (files[currentFileIndex].chunks.length === currentTotalChunks) {
              // Check if all files are complete
              const allComplete = files.every(f => f.chunks.length > 0);

              if (allComplete) {
                // Reconstruct all files
                const receivedFiles = files.map(f => {
                  const blob = new Blob(f.chunks, { type: f.type });
                  return new File([blob], f.name, {
                    type: f.type,
                    lastModified: Date.now(),
                  });
                });

                onFileReceived(receivedFiles);
                
                // Clean up storage
                await this.storage.deleteTransferState(this.transferId);
                
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

  private async readChunkFromStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    size: number
  ): Promise<ArrayBuffer> {
    const chunks: Uint8Array[] = [];
    let bytesRead = 0;

    while (bytesRead < size) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const remainingBytes = size - bytesRead;
      const bytesToTake = Math.min(value.length, remainingBytes);
      
      if (bytesToTake === value.length) {
        chunks.push(value);
      } else {
        chunks.push(value.slice(0, bytesToTake));
      }
      
      bytesRead += bytesToTake;
    }

    // Combine chunks
    const result = new Uint8Array(bytesRead);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result.buffer;
  }

  private async saveTransferState(state: TransferStateData): Promise<void> {
    try {
      await this.storage.saveTransferState(state);
    } catch (error) {
      console.error('Failed to save transfer state:', error);
    }
  }

  async getTransferState(): Promise<TransferStateData | null> {
    return this.storage.getTransferState(this.transferId);
  }

  cancel() {
    this.isPaused = true;
    if (this.abortController) {
      this.abortController.abort();
    }
    this.webrtc.disconnect();
  }

  async cleanup() {
    await this.storage.deleteTransferState(this.transferId);
    this.storage.close();
  }
}

