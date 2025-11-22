'use client';

import { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { copyToClipboard } from '@/lib/utils';

interface ShareLinkProps {
  link: string;
}

export default function ShareLink({ link }: ShareLinkProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await copyToClipboard(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <div className="flex items-center space-x-2 p-4 bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-xl border-2 border-primary-300 dark:border-primary-700">
        <Share2 className="w-5 h-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
        <input
          type="text"
          value={link}
          readOnly
          className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-gray-800 dark:text-gray-200 truncate font-medium"
        />
        <button
          onClick={handleCopy}
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors flex-shrink-0 font-semibold text-sm shadow-md"
          title="Copy link"
        >
          {copied ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center space-x-1"
            >
              <Check className="w-4 h-4" />
              <span>Copied!</span>
            </motion.div>
          ) : (
            <div className="flex items-center space-x-1">
              <Copy className="w-4 h-4" />
              <span>Copy</span>
            </div>
          )}
        </button>
      </div>
      <div className="mt-3 space-y-3">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">📝 How to share:</p>
          <ol className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
            <li>Click the <strong>Copy</strong> button above</li>
            <li>Send the link via WhatsApp, Email, or any messenger</li>
            <li><strong>Return to this tab immediately</strong></li>
            <li>Keep this tab open and visible until transfer completes</li>
          </ol>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <p className="text-xs text-yellow-800 dark:text-yellow-300 text-center">
            ⚠️ <strong>Critical:</strong> Do not minimize or close this tab! Switching tabs may cause the connection to fail.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

