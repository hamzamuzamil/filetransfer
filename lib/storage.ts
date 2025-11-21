// IndexedDB storage for transfer persistence and resume capability
export interface TransferStateData {
  id: string;
  type: 'sender' | 'receiver';
  files: {
    name: string;
    size: number;
    type: string;
    lastModified: number;
  }[];
  progress: {
    bytesTransferred: number;
    totalBytes: number;
    percentage: number;
  };
  receivedChunks: {
    [fileIndex: number]: {
      [chunkIndex: number]: boolean;
    };
  };
  passwordData?: {
    testString: string;
    salt: string;
    iv: string;
  };
  timestamp: number;
  expiresAt: number;
}

export class StorageManager {
  private static DB_NAME = 'P2PFileTransferDB';
  private static DB_VERSION = 1;
  private static STORE_NAME = 'transfers';
  private static CHUNKS_STORE = 'chunks';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(StorageManager.DB_NAME, StorageManager.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create transfers store
        if (!db.objectStoreNames.contains(StorageManager.STORE_NAME)) {
          db.createObjectStore(StorageManager.STORE_NAME, { keyPath: 'id' });
        }

        // Create chunks store for large file handling
        if (!db.objectStoreNames.contains(StorageManager.CHUNKS_STORE)) {
          const chunkStore = db.createObjectStore(StorageManager.CHUNKS_STORE, {
            keyPath: ['transferId', 'fileIndex', 'chunkIndex'],
          });
          chunkStore.createIndex('transferId', 'transferId', { unique: false });
        }
      };
    });
  }

  async saveTransferState(state: TransferStateData): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([StorageManager.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(StorageManager.STORE_NAME);
      const request = store.put(state);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTransferState(id: string): Promise<TransferStateData | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([StorageManager.STORE_NAME], 'readonly');
      const store = transaction.objectStore(StorageManager.STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as TransferStateData | undefined;
        
        // Check if expired
        if (result && result.expiresAt < Date.now()) {
          this.deleteTransferState(id);
          resolve(null);
        } else {
          resolve(result || null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTransferState(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [StorageManager.STORE_NAME, StorageManager.CHUNKS_STORE],
        'readwrite'
      );
      
      // Delete transfer state
      const store = transaction.objectStore(StorageManager.STORE_NAME);
      store.delete(id);

      // Delete associated chunks
      const chunkStore = transaction.objectStore(StorageManager.CHUNKS_STORE);
      const index = chunkStore.index('transferId');
      const chunkRequest = index.openCursor(IDBKeyRange.only(id));

      chunkRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async saveChunk(
    transferId: string,
    fileIndex: number,
    chunkIndex: number,
    data: ArrayBuffer
  ): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([StorageManager.CHUNKS_STORE], 'readwrite');
      const store = transaction.objectStore(StorageManager.CHUNKS_STORE);
      
      const request = store.put({
        transferId,
        fileIndex,
        chunkIndex,
        data,
        timestamp: Date.now(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getChunk(
    transferId: string,
    fileIndex: number,
    chunkIndex: number
  ): Promise<ArrayBuffer | null> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([StorageManager.CHUNKS_STORE], 'readonly');
      const store = transaction.objectStore(StorageManager.CHUNKS_STORE);
      const request = store.get([transferId, fileIndex, chunkIndex]);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllChunksForFile(
    transferId: string,
    fileIndex: number
  ): Promise<{ chunkIndex: number; data: ArrayBuffer }[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([StorageManager.CHUNKS_STORE], 'readonly');
      const store = transaction.objectStore(StorageManager.CHUNKS_STORE);
      const index = store.index('transferId');
      const request = index.openCursor(IDBKeyRange.only(transferId));

      const chunks: { chunkIndex: number; data: ArrayBuffer }[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const value = cursor.value;
          if (value.fileIndex === fileIndex) {
            chunks.push({
              chunkIndex: value.chunkIndex,
              data: value.data,
            });
          }
          cursor.continue();
        } else {
          // Sort by chunk index
          chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
          resolve(chunks);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async cleanupExpiredTransfers(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([StorageManager.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(StorageManager.STORE_NAME);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const state = cursor.value as TransferStateData;
          if (state.expiresAt < Date.now()) {
            this.deleteTransferState(state.id);
          }
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getStorageUsage(): Promise<{ used: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }
    return { used: 0, quota: 0 };
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Progress persistence in localStorage
export class ProgressPersistence {
  private static STORAGE_KEY = 'p2p_transfer_progress';

  static save(id: string, progress: any): void {
    try {
      const data = {
        [id]: {
          ...progress,
          timestamp: Date.now(),
        },
      };
      const existing = this.getAll();
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({ ...existing, ...data })
      );
    } catch (error) {
      console.error('Failed to save progress:', error);
    }
  }

  static get(id: string): any | null {
    try {
      const all = this.getAll();
      const progress = all[id];
      
      // Expire after 24 hours
      if (progress && Date.now() - progress.timestamp > 24 * 60 * 60 * 1000) {
        this.delete(id);
        return null;
      }
      
      return progress || null;
    } catch (error) {
      console.error('Failed to get progress:', error);
      return null;
    }
  }

  static getAll(): Record<string, any> {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Failed to get all progress:', error);
      return {};
    }
  }

  static delete(id: string): void {
    try {
      const all = this.getAll();
      delete all[id];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
    } catch (error) {
      console.error('Failed to delete progress:', error);
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear progress:', error);
    }
  }
}

