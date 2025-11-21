'use client';

import { motion } from 'framer-motion';
import { TransferProgress } from '@/types';
import { formatBytes, formatSpeed, formatTime } from '@/lib/utils';

interface ProgressBarProps {
  progress: TransferProgress;
  fileName?: string;
}

export default function ProgressBar({ progress, fileName }: ProgressBarProps) {
  return (
    <div className="w-full space-y-2">
      {fileName && (
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
          {fileName}
        </p>
      )}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress.percentage}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
        <span>
          {formatBytes(progress.bytesTransferred)} / {formatBytes(progress.totalBytes)}
        </span>
        <div className="flex items-center space-x-4">
          <span>{formatSpeed(progress.speed)}</span>
          <span>{formatTime(progress.timeRemaining)} remaining</span>
        </div>
      </div>
    </div>
  );
}

