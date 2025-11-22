'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Download, Copy, Check, Loader2, CheckCircle2 } from 'lucide-react';
import { WebTorrentManager } from '@/lib/webtorrent-manager';
import QRCode from 'qrcode';

export default function SimplePage() {
  const [file, setFile] = useState<File | null>(null);
  const [magnetLink, setMagnetLink] = useState<string>('');
  const [shareLink, setShareLink] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'sharing' | 'downloading' | 'complete'>('idle');
  const [progress, setProgress] = useState(0);
  const [peers, setPeers] = useState(0);
  const [copied, setCopied] = useState(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [downloadedFile, setDownloadedFile] = useState<File | null>(null);
  const [torrentManager, setTorrentManager] = useState<WebTorrentManager | null>(null);

  useEffect(() => {
    // Check if we have a magnet link in URL
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const magnet = params.get('magnet');
      if (magnet) {
        setMagnetLink(decodeURIComponent(magnet));
        setStatus('downloading');
        startDownload(decodeURIComponent(magnet));
      }
    }

    // Initialize WebTorrent
    const manager = new WebTorrentManager();
    setTorrentManager(manager);

    return () => {
      manager.destroy();
    };
  }, []);

  const startDownload = useCallback(async (magnet: string) => {
    const manager = new WebTorrentManager();
    setTorrentManager(manager);

    try {
      await manager.downloadFile(
        magnet,
        (prog) => {
          setProgress(prog);
          setPeers(manager.getNumPeers());
        },
        (file) => {
          setDownloadedFile(file);
          setStatus('complete');
        },
        (error) => {
          console.error('Download error:', error);
          alert('Download failed: ' + error.message);
        }
      );
    } catch (error) {
      console.error('Failed to start download:', error);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      handleUpload(selectedFile);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      handleUpload(droppedFile);
    }
  }, []);

  const handleUpload = async (fileToUpload: File) => {
    if (!torrentManager) return;

    setStatus('uploading');
    try {
      const magnet = await torrentManager.seedFile(fileToUpload);
      setMagnetLink(magnet);
      
      // Create share link
      const shareUrl = `${window.location.origin}/simple?magnet=${encodeURIComponent(magnet)}`;
      setShareLink(shareUrl);
      
      // Generate QR code
      const qr = await QRCode.toDataURL(shareUrl, { width: 300 });
      setQrCode(qr);
      
      setStatus('sharing');

      // Monitor peers
      const interval = setInterval(() => {
        if (torrentManager) {
          setPeers(torrentManager.getNumPeers());
        }
      }, 1000);

      return () => clearInterval(interval);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed: ' + (error as Error).message);
    }
  };

  const handleCopy = async () => {
    if (shareLink) {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadFile = () => {
    if (downloadedFile) {
      const url = URL.createObjectURL(downloadedFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadedFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleReset = () => {
    setFile(null);
    setMagnetLink('');
    setShareLink('');
    setStatus('idle');
    setProgress(0);
    setPeers(0);
    setDownloadedFile(null);
    if (torrentManager) {
      torrentManager.destroy();
    }
    const manager = new WebTorrentManager();
    setTorrentManager(manager);
    
    // Clear URL
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            🍕 P2P File Share
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Peer-to-peer file transfers in your browser - Just like file.pizza!
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <AnimatePresence mode="wait">
          {status === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-4 border-dashed border-blue-300 dark:border-blue-700 rounded-3xl p-16 hover:border-blue-500 transition-colors cursor-pointer bg-white/50 dark:bg-gray-800/50"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <Upload className="w-20 h-20 text-blue-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">Drop a file to get started</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  or click to browse
                </p>
                <input
                  id="file-input"
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </motion.div>
          )}

          {status === 'uploading' && (
            <motion.div
              key="uploading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-6"
            >
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto" />
              <h2 className="text-2xl font-bold">Preparing your file...</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Creating peer-to-peer connection
              </p>
            </motion.div>
          )}

          {status === 'sharing' && (
            <motion.div
              key="sharing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="text-center mb-6">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-3xl font-bold mb-2">Ready to Share!</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Keep this page open while file is being downloaded
                </p>
              </div>

              {/* QR Code */}
              {qrCode && (
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-2xl shadow-xl">
                    <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                    <p className="text-sm text-center text-gray-600 mt-2">
                      Scan with phone to download
                    </p>
                  </div>
                </div>
              )}

              {/* Share Link */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 bg-gray-50 dark:bg-gray-700 px-4 py-3 rounded-lg text-sm font-mono"
                  />
                  <button
                    onClick={handleCopy}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                
                {/* Peers Info */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Connected Peers:</span>
                    <span className="text-lg font-bold text-blue-600">{peers}</span>
                  </div>
                  {peers === 0 && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                      Waiting for someone to download...
                    </p>
                  )}
                  {peers > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                      🎉 Someone is downloading your file!
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={handleReset}
                className="w-full py-3 bg-gray-200 dark:bg-gray-700 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Share Another File
              </button>
            </motion.div>
          )}

          {status === 'downloading' && (
            <motion.div
              key="downloading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="text-center mb-6">
                <Download className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-bounce" />
                <h2 className="text-2xl font-bold mb-2">Downloading...</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Connecting to peers and downloading file
                </p>
              </div>

              {/* Progress */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg">
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Progress</span>
                    <span className="font-bold">{progress.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Connected Peers:</span>
                    <span className="text-lg font-bold text-blue-600">{peers}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {status === 'complete' && downloadedFile && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-6"
            >
              <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />
              <h2 className="text-3xl font-bold mb-2">Download Complete!</h2>
              <p className="text-gray-600 dark:text-gray-400">
                {downloadedFile.name} ({(downloadedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>

              <button
                onClick={handleDownloadFile}
                className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-semibold text-lg shadow-lg transition-all"
              >
                <Download className="w-5 h-5 inline mr-2" />
                Save File
              </button>

              <button
                onClick={handleReset}
                className="w-full py-3 bg-gray-200 dark:bg-gray-700 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Share Another File
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>🍕 Peer-to-peer file sharing powered by WebTorrent • No server storage • Direct transfers</p>
      </footer>
    </div>
  );
}

