/**
 * BlockingLoadingModal
 * 
 * A modal overlay that blocks user interaction while an async operation is in progress.
 * Used for critical operations like assignment decisions that should not be interrupted.
 * 
 * Features:
 * - No close button (operation cannot be cancelled once started)
 * - Backdrop click disabled
 * - Escape key disabled
 * - Animated spinner
 * - Customizable title and message
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

interface BlockingLoadingModalProps {
  open: boolean;
  title?: string;
  message?: string;
}

export function BlockingLoadingModal({
  open,
  title = 'Processing...',
  message = 'Please wait while we complete your request.'
}: BlockingLoadingModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => e.stopPropagation()} // Prevent clicks from closing
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div className="bg-white dark:bg-[#1E293B] rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center text-center">
          {/* Animated Spinner */}
          <div className="mb-4">
            <Loader2 className="h-12 w-12 text-blue-600 dark:text-blue-400 animate-spin" />
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {title}
          </h3>

          {/* Message */}
          {message && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {message}
            </p>
          )}

          {/* Visual indicator that modal cannot be closed */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 w-full">
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Please do not close or refresh this page
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
