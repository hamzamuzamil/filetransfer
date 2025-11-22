'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, X, HelpCircle } from 'lucide-react';
import { WebTorrentClient, TorrentProgress } from '@/lib/webtorrent-client';
import { QRCodeSVG } from 'qrcode.react';

export default function Home() {
  const [mode, setMode] = useState<'select' | 'seeding' | 'downloading'>('select');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPasswordHelp, setShowPasswordHelp] = useState(false);
  const [magnetURI, setMagnetURI] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState<TorrentProgress>({
    progress: 0,
    downloaded: 0,
    total: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    peers: 0,
    timeRemaining: 0,
  });
  const [error, setError] = useState('');
  const [downloadPassword, setDownloadPassword] = useState('');
  const [downloadedFile, setDownloadedFile] = useState<{ blob: Blob; filename: string } | null>(null);

  const clientRef = useRef<WebTorrentClient | null>(null);

  useEffect(() => {
    clientRef.current = new WebTorrentClient();

    // Check if this is a download link
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const magnet = params.get('magnet');
      if (magnet) {
        setMode('downloading');
        setMagnetURI(decodeURIComponent(magnet));
      }
    }

    return () => {
      if (clientRef.current) {
        clientRef.current.destroy();
      }
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
    }
  };

  const handleStart = () => {
    if (!file || !clientRef.current) return;

    setError('');
    setMode('seeding');

    clientRef.current.seedFile(
      file,
      password,
      (progress) => {
        setProgress(progress);
      },
      (magnet) => {
        console.log('Received magnet URI:', magnet);
        setMagnetURI(magnet);
        const url = `${window.location.origin}?magnet=${encodeURIComponent(magnet)}`;
        console.log('Share URL:', url);
        setShareUrl(url);
      },
      (error) => {
        console.error('Seeding error:', error);
        setError(error.message);
        setMode('select');
      }
    );
  };

  const handleDownload = () => {
    if (!clientRef.current || !magnetURI) return;

    setError('');

    clientRef.current.downloadFile(
      magnetURI,
      downloadPassword,
      (progress) => {
        setProgress(progress);
      },
      (blob, filename) => {
        setDownloadedFile({ blob, filename });
      },
      (error) => {
        setError(error.message);
      }
    );
  };

  const handleSaveFile = () => {
    if (!downloadedFile) return;

    const url = URL.createObjectURL(downloadedFile.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = downloadedFile.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStopUpload = () => {
    if (clientRef.current) {
      clientRef.current.stopSeeding();
    }
    setMode('select');
    setFile(null);
    setPassword('');
    setMagnetURI('');
    setShareUrl('');
    setProgress({
      progress: 0,
      downloaded: 0,
      total: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      peers: 0,
      timeRemaining: 0,
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond: number) => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 
            className="text-6xl font-bold mb-2 cursor-pointer"
            onClick={() => window.location.href = '/'}
            style={{ 
              fontFamily: 'cursive',
              color: '#ff6b6b',
              textShadow: '3px 3px 0px rgba(255,107,107,0.2)'
            }}
          >
            🍕 FilePizza
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 max-w-3xl">
        <AnimatePresence mode="wait">
          {/* File Selection Mode */}
          {mode === 'select' && (
        <motion.div
              key="select"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white dark:bg-gray-800 rounded-3xl p-12 shadow-2xl"
              >
                <div className="text-center mb-8">
                <div className="w-48 h-48 mx-auto mb-8 relative">
                  <svg viewBox="0 0 200 200" className="w-full h-full">
                    {/* Pizza slice illustration */}
                    <circle cx="100" cy="100" r="80" fill="#ff6b6b" />
                    <path d="M 100 100 L 180 100 A 80 80 0 0 1 100 180 Z" fill="#ffa500" />
                    <circle cx="130" cy="130" r="8" fill="#ff0000" />
                    <circle cx="150" cy="110" r="6" fill="#ff0000" />
                    <circle cx="120" cy="150" r="7" fill="#00ff00" />
                  </svg>
                </div>

                <h2 className="text-3xl font-bold mb-4 text-gray-800 dark:text-white">
                  You are about to start uploading {file ? '1 file' : 'files'}
                  {file && <button 
                    onClick={() => {
                      document.getElementById('file-input')?.click();
                    }}
                    className="ml-3 text-blue-500 hover:text-blue-600 text-lg font-normal underline"
                  >
                    Add more files
                  </button>}
                </h2>
              </div>

              {file ? (
                <div className="space-y-6">
                  {/* Selected File */}
                  <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-white font-medium truncate">{file.name}</div>
                      <div className="text-gray-400 text-sm">{file.type || 'unknown type'}</div>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="ml-4 text-gray-400 hover:text-white"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Password Field */}
                        <div>
                    <div className="flex items-center mb-2">
                      <label className="text-gray-700 dark:text-gray-300 font-medium">
                        Password (optional)
                      </label>
                      <button
                        onClick={() => setShowPasswordHelp(!showPasswordHelp)}
                        className="ml-2 text-gray-400 hover:text-gray-600"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                        </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter a secret password for this slice of FilePizza..."
                      className="w-full bg-gray-50 dark:bg-gray-700 px-4 py-4 rounded-lg border-2 border-blue-400 focus:border-blue-500 focus:outline-none text-gray-800 dark:text-white"
                    />
                    {showPasswordHelp && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                        💡 Add a password to encrypt your file before sharing. The receiver will need this password to download it.
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
                      {error}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-4">
                    <button
                      onClick={() => {
                        setFile(null);
                        setPassword('');
                        setError('');
                      }}
                      className="flex-1 py-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-lg font-semibold text-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleStart}
                      className="flex-1 py-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-lg transition-colors shadow-lg"
                    >
                      Start
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => document.getElementById('file-input')?.click()}
                  className="border-4 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-16 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all"
                >
                  <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
                    Click here to select a file
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    or drag and drop
                  </p>
                </div>
              )}

              <input
                id="file-input"
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                />
              </motion.div>
            )}

          {/* Seeding Mode */}
          {mode === 'seeding' && (
              <motion.div
              key="seeding"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-3xl p-12 shadow-2xl space-y-8"
            >
              <div className="text-center">
                <h2 className="text-3xl font-bold mb-2 text-gray-800 dark:text-white">
                  You are uploading 1 file.
                </h2>
                <p className="text-red-600 dark:text-red-400 font-medium text-lg">
                  Leave this tab open. FilePizza does not store files.
                </p>
              </div>

              {/* File Info */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-white font-medium truncate">{file?.name}</div>
                <div className="text-gray-400 text-sm">{file?.type || 'unknown type'}</div>
              </div>

              {magnetURI && (
                <>
                  {!shareUrl && (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                      <p className="text-gray-600 dark:text-gray-400">Generating share link...</p>
                    </div>
                  )}
                  
                  {shareUrl && (
                    <div className="space-y-6">
                      {/* QR Code */}
                      <div className="flex justify-center">
                        <div className="bg-white p-4 rounded-lg">
                          <QRCodeSVG value={shareUrl} size={200} />
                        </div>
                      </div>

                  {/* Share URL */}
                  <div>
                    <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                      Long URL
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="text"
                        value={shareUrl}
                        readOnly
                        className="flex-1 bg-gray-50 dark:bg-gray-700 px-4 py-3 rounded-lg text-sm font-mono border-2 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-white"
                      />
                      <button
                        onClick={handleCopy}
                        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
                      >
                        {copied ? (
                          <span className="flex items-center">
                            <Check className="w-4 h-4 mr-2" />
                            Copied!
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <Copy className="w-4 h-4 mr-2" />
                            Copy
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                    <div className="text-center mb-4">
                      <div className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
                        {progress.peers} Downloading, {progress.peers} Total
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-600 dark:text-gray-400">Upload Speed</div>
                        <div className="font-semibold text-gray-800 dark:text-white">
                          {formatSpeed(progress.uploadSpeed)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-600 dark:text-gray-400">Uploaded</div>
                        <div className="font-semibold text-gray-800 dark:text-white">
                          {formatBytes(progress.downloaded)}
                        </div>
                      </div>
                    </div>
                  </div>

                      {/* Stop Button */}
                      <button
                        onClick={handleStopUpload}
                        className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold text-lg transition-colors"
                      >
                        🛑 Stop Upload
                      </button>
                    </div>
                  )}
                </>
              )}
              </motion.div>
            )}

          {/* Downloading Mode */}
          {mode === 'downloading' && (
              <motion.div
              key="downloading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-3xl p-12 shadow-2xl space-y-8"
            >
              <div className="text-center">
                <h2 className="text-3xl font-bold mb-4 text-gray-800 dark:text-white">
                  {downloadedFile ? 'Download Complete!' : 'Download File'}
                  </h2>
              </div>

              {!downloadedFile ? (
                <div className="space-y-6">
                  {magnetURI.includes('x.encrypted=true') && (
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                        Password Required
                      </label>
                      <input
                        type="password"
                        value={downloadPassword}
                        onChange={(e) => setDownloadPassword(e.target.value)}
                        placeholder="Enter the password to decrypt this file..."
                        className="w-full bg-gray-50 dark:bg-gray-700 px-4 py-4 rounded-lg border-2 border-blue-400 focus:border-blue-500 focus:outline-none text-gray-800 dark:text-white"
                      />
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-300">
                      {error}
                    </div>
                  )}

                  {progress.progress > 0 && (
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Progress</span>
                        <span className="font-bold text-blue-600">{(progress.progress * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-500 h-4 rounded-full transition-all duration-300"
                          style={{ width: `${progress.progress * 100}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <div className="text-gray-600 dark:text-gray-400">Speed</div>
                          <div className="font-semibold text-gray-800 dark:text-white">
                            {formatSpeed(progress.downloadSpeed)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600 dark:text-gray-400">Downloaded</div>
                          <div className="font-semibold text-gray-800 dark:text-white">
                            {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-600 dark:text-gray-400">Peers</div>
                          <div className="font-semibold text-gray-800 dark:text-white">
                            {progress.peers}
                          </div>
                        </div>
                      </div>
                </div>
                  )}
                
                  <button
                    onClick={handleDownload}
                    disabled={progress.progress > 0 && progress.progress < 1}
                    className="w-full py-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white rounded-lg font-semibold text-lg transition-colors"
                  >
                    {progress.progress > 0 && progress.progress < 1 ? 'Downloading...' : 'Start Download'}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center text-6xl mb-4">✅</div>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 text-center">
                    <div className="font-semibold text-lg text-gray-800 dark:text-white mb-2">
                      {downloadedFile.filename}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {formatBytes(downloadedFile.blob.size)}
                    </div>
                </div>
                  <button
                    onClick={handleSaveFile}
                    className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-lg transition-colors"
                  >
                    💾 Save File
                </button>
                </div>
              )}
              </motion.div>
            )}
          </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>🍕 Free peer-to-peer file transfers in your browser • No storage, just streaming</p>
      </footer>
    </div>
  );
}
