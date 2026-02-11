import React from 'react';
import { AlertCircle, Mail } from 'lucide-react';
import { formatDateTimeET } from '../lib/timezoneUtils';

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
  if (!pendingApproval || approvalStatus === 'approved') {
    return null;
  }

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
            <Mail className="inline h-4 w-4 mr-1" />
            Email sent: {formatDateTimeET(pendingApproval.sentAt)}
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
      </div>
    </div>
  );
}
