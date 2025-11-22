'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Download, Loader2, CheckCircle2, XCircle, RefreshCw, Shield, Pause, Play } from 'lucide-react';
import FileDropZone from '@/components/FileDropZone';
import ProgressBar from '@/components/ProgressBar';
import ShareLink from '@/components/ShareLink';
import ThemeToggle from '@/components/ThemeToggle';
import PasswordInput from '@/components/PasswordInput';
import ResumeTransferDialog from '@/components/ResumeTransferDialog';
import { WebRTCManager } from '@/lib/webrtc';
import { FileTransferManagerEnhanced } from '@/lib/fileTransferEnhanced';
import { EncryptionManager } from '@/lib/encryption';
import { StorageManager, ProgressPersistence, TransferStateData } from '@/lib/storage';
import { TransferState, TransferProgress } from '@/types';
import { generateShareLink } from '@/lib/utils';

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [transferState, setTransferState] = useState<TransferState>('idle');
  const [progress, setProgress] = useState<TransferProgress | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string>('');
  const [receivedFiles, setReceivedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [webrtcManager, setWebrtcManager] = useState<WebRTCManager | null>(null);
  const [transferManager, setTransferManager] = useState<FileTransferManagerEnhanced | null>(null);
  
  // Password protection
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [passwordMode, setPasswordMode] = useState<'set' | 'verify'>('set');
  const [passwordError, setPasswordError] = useState<string>('');
  const [passwordVerifier, setPasswordVerifier] = useState<any>(null);
  
  // Resume functionality
  const [resumeDialogOpen, setResumeDialogOpen] = useState(false);
  const [resumeData, setResumeData] = useState<TransferStateData | null>(null);
  
  // Pause/Resume
  const [isPaused, setIsPaused] = useState(false);
  
  // Storage manager
  const [storageManager] = useState(() => new StorageManager());

  // Check if we're receiving (has connection ID in URL)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('id');
      if (id) {
        setConnectionId(id);
        checkForResumeData(id);
      }
    }

    // Cleanup expired transfers on mount
    storageManager.init().then(() => {
      storageManager.cleanupExpiredTransfers();
    });

    // Monitor memory usage
    const memoryInterval = setInterval(checkMemoryUsage, 30000); // Every 30 seconds

    return () => {
      clearInterval(memoryInterval);
    };
  }, []);

  const checkMemoryUsage = async () => {
    const usage = await storageManager.getStorageUsage();
    const usagePercent = (usage.used / usage.quota) * 100;
    
    if (usagePercent > 80) {
      console.warn('Storage usage high:', usagePercent.toFixed(2) + '%');
      // Optionally show warning to user
    }
  };

  const checkForResumeData = async (id: string) => {
    try {
      const savedState = await storageManager.getTransferState(id);
      if (savedState && savedState.progress.percentage < 100) {
        setResumeData(savedState);
        setResumeDialogOpen(true);
      } else {
        initializeReceiver(id);
      }
    } catch (error) {
      console.error('Error checking resume data:', error);
      initializeReceiver(id);
    }
  };

  const handleResumeTransfer = async () => {
    setResumeDialogOpen(false);
    if (resumeData && connectionId) {
      if (resumeData.type === 'receiver') {
        initializeReceiver(connectionId, resumeData);
      }
    }
  };

  const handleCancelResume = async () => {
    setResumeDialogOpen(false);
    if (connectionId) {
      // Clear old data and start fresh
      await storageManager.deleteTransferState(connectionId);
      initializeReceiver(connectionId);
    }
  };

  const initializeReceiver = async (id: string, resumeFrom?: TransferStateData) => {
    try {
      setTransferState('connecting');
      setError(null);
      
      const webrtc = new WebRTCManager();
      await webrtc.initialize(false, id);
      
      const transfer = new FileTransferManagerEnhanced(webrtc, id);
      await transfer.initialize();
      
      transfer.setCallbacks(
        (prog) => {
          setProgress(prog);
          setTransferState('transferring');
          // Persist progress
          ProgressPersistence.save(id, prog);
        },
        () => {
          setTransferState('completed');
          ProgressPersistence.delete(id);
        },
        (err) => {
          if (err.message === 'PASSWORD_REQUIRED') {
            setPasswordMode('verify');
            setShowPasswordInput(true);
            setPasswordError('This transfer is password protected');
          } else {
            setError(err.message);
            setTransferState('error');
          }
        }
      );

      setWebrtcManager(webrtc);
      setTransferManager(transfer);

      // Restore progress if resuming
      if (resumeFrom) {
        setProgress({
          bytesTransferred: resumeFrom.progress.bytesTransferred,
          totalBytes: resumeFrom.progress.totalBytes,
          percentage: resumeFrom.progress.percentage,
          speed: 0,
          timeRemaining: 0,
        });
      }

      // Wait for connection with timeout
      console.log('Receiver: Waiting for sender connection...');
      const connectionTimeout = setTimeout(() => {
        if (transfer) {
          setError('Connection timeout. The sender may not be online or the link has expired. Please ask the sender to generate a new share link.');
          setTransferState('error');
          webrtc.disconnect();
        }
      }, 30000); // 30 seconds timeout

      // Start receiving
      transfer.receiveFiles((received) => {
        clearTimeout(connectionTimeout);
        setReceivedFiles(received);
      }, resumeFrom).catch((err) => {
        clearTimeout(connectionTimeout);
        setError((err as Error).message);
        setTransferState('error');
      });

    } catch (err) {
      const errorMsg = (err as Error).message;
      console.error('Receiver initialization error:', errorMsg);
      setError(errorMsg || 'Failed to connect. The sender might not be online or the link is invalid.');
      setTransferState('error');
    }
  };

  const handleFilesSelected = useCallback((selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setError(null);
  }, []);

  const handlePasswordSet = async (pwd: string) => {
    setPassword(pwd);
    setShowPasswordInput(false);
    setPasswordError('');

    if (passwordMode === 'set') {
      // Continue with sending
      proceedWithSend(pwd);
    } else if (passwordMode === 'verify' && transferManager) {
      // Verify and continue receiving
      transferManager.setPassword(pwd);
      setTransferState('connecting');
    }
  };

  const handlePasswordVerify = async (pwd: string): Promise<boolean> => {
    if (!passwordVerifier) return false;
    
    try {
      return await EncryptionManager.verifyPassword(
        passwordVerifier.testString,
        pwd,
        passwordVerifier.salt,
        passwordVerifier.iv
      );
    } catch {
      return false;
    }
  };

  const handleSend = async () => {
    if (files.length === 0) return;

    if (usePassword && !password) {
      setPasswordMode('set');
      setShowPasswordInput(true);
      return;
    }

    proceedWithSend(password || undefined);
  };

  const proceedWithSend = async (pwd?: string) => {
    try {
      setTransferState('preparing');
      setError(null);

      const webrtc = new WebRTCManager();
      const id = await webrtc.initialize(true);
      
      const transfer = new FileTransferManagerEnhanced(webrtc, id);
      await transfer.initialize();
      
      if (pwd) {
        transfer.setPassword(pwd);
      }
      
      transfer.setCallbacks(
        (prog) => {
          setProgress(prog);
          setTransferState('transferring');
          ProgressPersistence.save(id, prog);
        },
        () => {
          setTransferState('completed');
          ProgressPersistence.delete(id);
        },
        (err) => {
          setError(err.message);
          setTransferState('error');
        }
      );

      setWebrtcManager(webrtc);
      setTransferManager(transfer);
      setConnectionId(id);
      setShareLink(generateShareLink(id));
      setTransferState('connecting');

      // Wait for recipient to connect, then start sending
      (async () => {
        try {
          await webrtc.waitForConnection(60000); // Reduced to 60 seconds
          
          setTransferState('transferring');
          await transfer.sendFiles(files);
        } catch (err) {
          const errorMessage = (err as Error).message;
          setError(errorMessage);
          setTransferState('error');
          console.error('Transfer error:', err);
        }
      })();
    } catch (err) {
      setError((err as Error).message);
      setTransferState('error');
    }
  };

  const handlePauseResume = () => {
    if (!transferManager) return;
    
    if (isPaused) {
      transferManager.resume();
      setIsPaused(false);
    } else {
      transferManager.pause();
      setIsPaused(true);
    }
  };

  const handleReset = async () => {
    if (webrtcManager) {
      webrtcManager.disconnect();
    }
    
    if (transferManager) {
      await transferManager.cleanup();
    }
    
    if (connectionId) {
      ProgressPersistence.delete(connectionId);
    }
    
    setFiles([]);
    setTransferState('idle');
    setProgress(null);
    setConnectionId(null);
    setShareLink('');
    setReceivedFiles([]);
    setError(null);
    setWebrtcManager(null);
    setTransferManager(null);
    setPassword(null);
    setUsePassword(false);
    setShowPasswordInput(false);
    setPasswordError('');
    setIsPaused(false);
    
    // Clear URL
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleDownload = () => {
    receivedFiles.forEach((file) => {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  const isReceiving = connectionId && !shareLink;
  const isSending = shareLink.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center space-x-2"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
            <Send className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
            P2P File Share Pro
          </h1>
        </motion.div>
        <ThemeToggle />
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 md:p-12"
        >
          <AnimatePresence mode="wait">
            {transferState === 'idle' && !isReceiving && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold mb-2">Share Files Securely</h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Direct browser-to-browser transfers with encryption & resume capability
                  </p>
                </div>

                <FileDropZone
                  onFilesSelected={handleFilesSelected}
                  disabled={false}
                />

                {files.length > 0 && (
                  <>
                    {/* Password Protection Option */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between bg-gradient-to-r from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-primary-200 dark:border-primary-800"
                    >
                      <div className="flex items-center space-x-3">
                        <Shield className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        <div>
                          <p className="font-semibold text-sm">Password Protection</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Secure your files with encryption
                          </p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={usePassword}
                          onChange={(e) => setUsePassword(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                      </label>
                    </motion.div>

                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={handleSend}
                      className="w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold text-lg hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] flex items-center justify-center space-x-2"
                    >
                      <Send className="w-5 h-5" />
                      <span>Generate Share Link</span>
                    </motion.button>
                  </>
                )}
              </motion.div>
            )}

            {showPasswordInput && (
              <motion.div
                key="password-input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <PasswordInput
                  onPasswordSet={handlePasswordSet}
                  mode={passwordMode}
                  onVerify={passwordMode === 'verify' ? handlePasswordVerify : undefined}
                  error={passwordError}
                />
              </motion.div>
            )}

            {transferState === 'preparing' && (
              <motion.div
                key="preparing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-4"
              >
                <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto" />
                <p className="text-lg font-medium">Preparing secure connection...</p>
              </motion.div>
            )}

            {transferState === 'connecting' && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                {isSending && shareLink && (
                  <>
                    <div className="text-center mb-6">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="mb-4"
                      >
                        <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto" />
                      </motion.div>
                      <h2 className="text-2xl font-bold mb-2">Share This Link</h2>
                      <p className="text-gray-600 dark:text-gray-400 mb-2">
                        Waiting for recipient to connect...
                      </p>
                      {usePassword && (
                        <div className="inline-flex items-center space-x-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-4 py-2 rounded-lg mt-2">
                          <Shield className="w-4 h-4" />
                          <span className="text-sm font-medium">Password Protected</span>
                        </div>
                      )}
                    </div>
                    <ShareLink link={shareLink} />
                  </>
                )}
                {isReceiving && (
                  <div className="text-center space-y-4">
                    <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto" />
                    <p className="text-lg font-medium">Connecting to sender...</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Make sure the sender has their browser open with the share link page visible.
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Connection will timeout after 30 seconds if sender is not available.
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {transferState === 'transferring' && progress && (
              <motion.div
                key="transferring"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold mb-2">
                    {isSending ? 'Sending Files...' : 'Receiving Files...'}
                  </h2>
                  {isPaused && (
                    <div className="inline-flex items-center space-x-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 px-4 py-2 rounded-lg mt-2">
                      <Pause className="w-4 h-4" />
                      <span className="text-sm font-medium">Transfer Paused</span>
                    </div>
                  )}
                </div>
                <ProgressBar progress={progress} />
                
                {/* Pause/Resume Button */}
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={handlePauseResume}
                    className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center space-x-2"
                  >
                    {isPaused ? (
                      <>
                        <Play className="w-5 h-5" />
                        <span>Resume</span>
                      </>
                    ) : (
                      <>
                        <Pause className="w-5 h-5" />
                        <span>Pause</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}

            {transferState === 'completed' && (
              <motion.div
                key="completed"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200 }}
                >
                  <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />
                </motion.div>
                <div>
                  <h2 className="text-3xl font-bold mb-2">
                    {isSending ? 'Transfer Complete!' : 'Files Received!'}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {isSending 
                      ? 'Your files have been successfully sent.' 
                      : `${receivedFiles.length} file(s) ready to download.`
                    }
                  </p>
                </div>
                {isReceiving && receivedFiles.length > 0 && (
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={handleDownload}
                    className="px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold text-lg hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg hover:shadow-xl flex items-center space-x-2 mx-auto"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download {receivedFiles.length > 1 ? 'Files' : 'File'}</span>
                  </motion.button>
                )}
                <button
                  onClick={handleReset}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 flex items-center space-x-2 mx-auto"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Share More Files</span>
                </button>
              </motion.div>
            )}

            {transferState === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-6"
              >
                <XCircle className="w-20 h-20 text-red-500 mx-auto" />
                <div>
                  <h2 className="text-2xl font-bold mb-2 text-red-600 dark:text-red-400">
                    Transfer Failed
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    {error || 'An error occurred during the transfer.'}
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Try Again
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6"
        >
          {[
            { icon: '🔒', title: 'Encrypted', desc: 'Password protection' },
            { icon: '⚡', title: 'Fast', desc: 'Direct P2P transfer' },
            { icon: '🔄', title: 'Resume', desc: 'Interrupt & continue' },
            { icon: '💾', title: 'Large Files', desc: 'Optimized memory' },
          ].map((feature, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + idx * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 text-center shadow-lg"
            >
              <div className="text-4xl mb-3">{feature.icon}</div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{feature.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Production-Ready P2P File Sharing • End-to-End Encrypted • Zero Server Storage</p>
      </footer>

      {/* Resume Dialog */}
      <ResumeTransferDialog
        isOpen={resumeDialogOpen}
        transferState={resumeData}
        onResume={handleResumeTransfer}
        onCancel={handleCancelResume}
      />
    </div>
  );
}
