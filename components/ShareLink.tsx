'use client';

import { useState, useEffect, useRef } from 'react';
import { Copy, Check, Share2, QrCode as QrCodeIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { copyToClipboard } from '@/lib/utils';
import QRCode from 'qrcode';

interface ShareLinkProps {
  link: string;
}

export default function ShareLink({ link }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [canShare, setCanShare] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Check if Web Share API is available
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share);

    // Generate QR code
    QRCode.toDataURL(link, {
      width: 300,
      margin: 2,
      color: {
        dark: '#1e40af',
        light: '#ffffff',
      },
    }).then(setQrCodeUrl).catch(console.error);
  }, [link]);

  const handleCopy = async () => {
    try {
      await copyToClipboard(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'P2P File Share',
          text: 'Open this link to receive my file:',
          url: link,
        });
      }
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full space-y-4"
    >
      {/* QR Code Section */}
      <div className="flex justify-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="bg-white dark:bg-gray-700 p-4 rounded-2xl shadow-xl"
        >
          {qrCodeUrl && (
            <div className="text-center space-y-2">
              <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64 mx-auto" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                📱 Scan with phone to share
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Share Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        {canShare && (
          <button
            onClick={handleShare}
            className="flex-1 py-3 px-6 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center space-x-2"
          >
            <Share2 className="w-5 h-5" />
            <span>Share Link</span>
          </button>
        )}
        <button
          onClick={handleCopy}
          className={`flex-1 py-3 px-6 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl font-semibold shadow-lg transition-all flex items-center justify-center space-x-2 ${
            copied ? 'from-green-500 to-green-600' : ''
          }`}
        >
          {copied ? (
            <>
              <Check className="w-5 h-5" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              <span>Copy Link</span>
            </>
          )}
        </button>
      </div>

      {/* Link Display */}
      <div className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <input
          type="text"
          value={link}
          readOnly
          className="flex-1 bg-transparent border-none outline-none text-xs font-mono text-gray-600 dark:text-gray-400 truncate"
        />
      </div>

      {/* Instructions */}
      <div className="space-y-3">
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-4">
          <p className="text-sm font-bold text-red-900 dark:text-red-300 mb-2 text-center">
            🚨 CRITICAL: Do NOT Close This Tab!
          </p>
          <p className="text-xs text-red-800 dark:text-red-300 text-center">
            You MUST keep this browser tab open and visible. If you close or minimize it, the transfer will fail!
          </p>
        </div>
        
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-sm font-semibold text-green-900 dark:text-green-300 mb-2">📤 How to Share:</p>
          <ol className="text-xs text-green-800 dark:text-green-300 space-y-1">
            <li><strong>Option 1:</strong> Scan QR code with phone → Send from phone</li>
            <li><strong>Option 2:</strong> Click "Share Link" → Choose WhatsApp/Email</li>
            <li><strong>Option 3:</strong> Click "Copy Link" → Paste in separate window</li>
          </ol>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-800 dark:text-blue-300 text-center">
            💡 <strong>Tip:</strong> Use your phone to scan the QR code. This way your computer tab stays open!
          </p>
        </div>
      </div>
    </motion.div>
  );
}

