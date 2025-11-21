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
      <div className="flex items-center space-x-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <Share2 className="w-5 h-5 text-primary-500 flex-shrink-0" />
        <input
          type="text"
          value={link}
          readOnly
          className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-gray-700 dark:text-gray-300 truncate"
        />
        <button
          onClick={handleCopy}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
          title="Copy link"
        >
          {copied ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            >
              <Check className="w-5 h-5 text-green-500" />
            </motion.div>
          ) : (
            <Copy className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          )}
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
        Share this link with the recipient to start the transfer
      </p>
    </motion.div>
  );
}

