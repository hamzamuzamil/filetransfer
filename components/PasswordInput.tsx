'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

interface PasswordInputProps {
  onPasswordSet: (password: string) => void;
  mode: 'set' | 'verify';
  onVerify?: (password: string) => Promise<boolean>;
  error?: string;
  disabled?: boolean;
}

export default function PasswordInput({
  onPasswordSet,
  mode,
  onVerify,
  error,
  disabled = false,
}: PasswordInputProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (mode === 'set') {
      if (!password) {
        setLocalError('Password is required');
        return;
      }

      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters');
        return;
      }

      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }

      onPasswordSet(password);
    } else if (mode === 'verify') {
      if (!password) {
        setLocalError('Please enter the password');
        return;
      }

      if (onVerify) {
        setIsVerifying(true);
        try {
          const isValid = await onVerify(password);
          if (isValid) {
            onPasswordSet(password);
          } else {
            setLocalError('Incorrect password');
          }
        } catch (err) {
          setLocalError('Failed to verify password');
        } finally {
          setIsVerifying(false);
        }
      }
    }
  };

  const displayError = error || localError;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-2xl p-6 border border-primary-200 dark:border-primary-800">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-primary-500 rounded-lg">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">
              {mode === 'set' ? 'Protect Your Files' : 'Password Required'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {mode === 'set'
                ? 'Set a password to secure this transfer'
                : 'Enter the password to access these files'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              {mode === 'set' ? 'Create Password' : 'Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={disabled || isVerifying}
                placeholder={mode === 'set' ? 'Enter password' : 'Enter password'}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {mode === 'set' && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={disabled}
                placeholder="Confirm password"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          )}

          {displayError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-3 rounded-xl"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{displayError}</span>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={disabled || isVerifying || !password}
            className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isVerifying ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <span>{mode === 'set' ? 'Set Password' : 'Unlock Files'}</span>
            )}
          </button>
        </form>

        {mode === 'set' && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
            Make sure to share this password securely with the recipient
          </p>
        )}
      </div>
    </motion.div>
  );
}

