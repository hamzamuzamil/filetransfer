'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Download, Copy, Check, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

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
    setStatus('uploading');
    setError('');
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          setShareUrl(data.url);
          setStatus('success');
        } else {
          setError('Upload failed. Please try again.');
          setStatus('error');
        }
      });

      xhr.addEventListener('error', () => {
        setError('Upload failed. Please check your connection.');
        setStatus('error');
      });

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    } catch (err) {
      setError('Upload failed: ' + (err as Error).message);
      setStatus('error');
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setFile(null);
    setStatus('idle');
    setUploadProgress(0);
    setShareUrl('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <div className="text-center">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            🍕 File Share
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Simple file sharing in your browser
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
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
                className="border-4 border-dashed border-blue-300 dark:border-blue-700 rounded-3xl p-20 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all cursor-pointer bg-white/80 dark:bg-gray-800/50 backdrop-blur"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <Upload className="w-24 h-24 text-blue-500 mx-auto mb-6" />
                <h2 className="text-3xl font-bold mb-3">Drop a file to get started</h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
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
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <Loader2 className="w-20 h-20 text-blue-500 animate-spin mx-auto mb-6" />
                <h2 className="text-3xl font-bold mb-3">Uploading...</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {file?.name} ({(file!.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              </div>

              {/* Progress Bar */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl">
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-3">
                    <span className="font-medium">Progress</span>
                    <span className="font-bold text-blue-600">{uploadProgress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-purple-500 h-4 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {status === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <CheckCircle2 className="w-24 h-24 text-green-500 mx-auto mb-6" />
                <h2 className="text-4xl font-bold mb-3">Upload Complete!</h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Your file is ready to share
                </p>
              </div>

              {/* Share Link */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
                    Share this link:
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 bg-gray-50 dark:bg-gray-700 px-4 py-4 rounded-xl text-sm font-mono border-2 border-gray-200 dark:border-gray-600 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleCopy}
                      className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl"
                    >
                      {copied ? (
                        <span className="flex items-center">
                          <Check className="w-5 h-5 mr-2" />
                          Copied!
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <Copy className="w-5 h-5 mr-2" />
                          Copy
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border-2 border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-300 text-center font-medium">
                    ✅ You can close this page now! The file will remain available for download.
                  </p>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="w-full py-4 bg-gray-200 dark:bg-gray-700 rounded-xl font-semibold text-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Share Another File
              </button>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-6"
            >
              <AlertCircle className="w-24 h-24 text-red-500 mx-auto" />
              <h2 className="text-3xl font-bold mb-3 text-red-600 dark:text-red-400">
                Upload Failed
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {error}
              </p>
              <button
                onClick={handleReset}
                className="px-8 py-4 bg-gray-200 dark:bg-gray-700 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Try Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>🍕 Simple file sharing • Upload once, share anywhere • Files stored securely</p>
      </footer>
    </div>
  );
}
