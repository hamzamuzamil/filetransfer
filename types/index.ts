export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface TransferProgress {
  bytesTransferred: number;
  totalBytes: number;
  percentage: number;
  speed: number; // bytes per second
  timeRemaining: number; // seconds
}

export interface PeerConnection {
  peer: any;
  dataChannel: RTCDataChannel | null;
  isConnected: boolean;
  connectionId: string;
}

export type TransferState = 
  | 'idle'
  | 'preparing'
  | 'connecting'
  | 'transferring'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface FileChunk {
  fileIndex: number;
  chunkIndex: number;
  totalChunks: number;
  data: ArrayBuffer;
  fileName: string;
  fileSize: number;
}

export interface PasswordProtection {
  enabled: boolean;
  verifier?: {
    testString: string;
    salt: string;
    iv: string;
  };
}

export interface TransferMetrics {
  startTime: number;
  endTime?: number;
  totalBytes: number;
  bytesTransferred: number;
  averageSpeed: number;
  peakSpeed: number;
  errors: number;
  retries: number;
}

export interface ConnectionQuality {
  type: 'excellent' | 'good' | 'fair' | 'poor';
  latency: number;
  packetLoss: number;
  bandwidth: number;
}
