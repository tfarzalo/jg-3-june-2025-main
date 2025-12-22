import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock } from 'lucide-react';

interface ApprovalCountdownBannerProps {
  pendingApproval: {
    tokenId: string;
    sentAt: Date;
    expiresAt: Date;
  } | null;
  approvalStatus: 'pending' | 'expired' | 'approved' | null;
  onOverrideApproval?: () => void;
  showOverrideButton?: boolean;
}

export function ApprovalCountdownBanner({
  pendingApproval,
  approvalStatus,
  onOverrideApproval,
  showOverrideButton = true
}: ApprovalCountdownBannerProps) {
  const [countdownTime, setCountdownTime] = useState<string>('');

  // Countdown timer effect
  useEffect(() => {
    if (!pendingApproval) return;

    const updateCountdown = () => {
      const now = new Date();
      const expiresAt = pendingApproval.expiresAt;
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdownTime('Expired');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setCountdownTime(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [pendingApproval]);

  if (!pendingApproval || approvalStatus === 'approved') {
    return null;
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  };

  return (
    <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 dark:from-amber-900/30 dark:via-orange-900/30 dark:to-amber-900/30 border-2 border-amber-400 dark:border-amber-600 rounded-xl p-4 mb-6 shadow-lg">
      <div className="flex items-start justify-between">
        {/* Left side: Status and info */}
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <div className="relative mr-3">
              <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-75"></div>
              <div className="relative bg-amber-500 rounded-full h-3 w-3"></div>
            </div>
            <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100">
              Approval Email Pending
            </h3>
          </div>
          
          <p className="text-sm text-amber-800 dark:text-amber-200 mb-1">
            Sent: {formatDate(pendingApproval.sentAt)}
          </p>
          
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Cannot send another approval email until this one expires or is approved.
          </p>
          
          {showOverrideButton && onOverrideApproval && (
            <button
              onClick={onOverrideApproval}
              className="mt-3 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Override & Send New Approval
            </button>
          )}
        </div>

        {/* Right side: Countdown timer */}
        <div className="flex flex-col items-end ml-4">
          <div className="bg-white dark:bg-gray-800 border-2 border-amber-400 dark:border-amber-600 rounded-lg px-4 py-2 shadow-md min-w-[140px]">
            <div className="text-xs font-medium text-amber-600 dark:text-amber-400 text-center mb-1">
              Expires In
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 text-center tabular-nums">
              {countdownTime}
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full mt-2 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-1000"
              style={{
                width: `${Math.max(0, Math.min(100, 
                  ((pendingApproval.expiresAt.getTime() - Date.now()) / (30 * 60 * 1000)) * 100
                ))}%`
              }}
            />
          </div>
          <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            {Math.round(((pendingApproval.expiresAt.getTime() - Date.now()) / (30 * 60 * 1000)) * 100)}% remaining
          </div>
        </div>
      </div>
    </div>
  );
}
