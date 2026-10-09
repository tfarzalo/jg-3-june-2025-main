import React, { useEffect, useState } from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface ApprovalDecisionAlertData {
  id: string;
  title: string;
  message: string;
  decision: 'approved' | 'declined';
  route?: string;
}

interface ApprovalDecisionAlertProps {
  alert: ApprovalDecisionAlertData;
  onClose: () => void;
}

export function ApprovalDecisionAlert({ alert, onClose }: ApprovalDecisionAlertProps) {
  const [isVisible, setIsVisible] = useState(false);
  const navigate = useNavigate();
  const isDeclined = alert.decision === 'declined';
  const displayDuration = isDeclined ? 12000 : 8000;

  useEffect(() => {
    const entranceTimer = window.setTimeout(() => setIsVisible(true), 50);
    const exitTimer = window.setTimeout(() => setIsVisible(false), displayDuration);
    const removalTimer = window.setTimeout(onClose, displayDuration + 500);

    return () => {
      window.clearTimeout(entranceTimer);
      window.clearTimeout(exitTimer);
      window.clearTimeout(removalTimer);
    };
  }, [displayDuration, onClose]);

  const close = () => {
    setIsVisible(false);
    window.setTimeout(onClose, 300);
  };

  const openJob = () => {
    if (alert.route) navigate(alert.route);
  };

  const Icon = isDeclined ? XCircle : CheckCircle2;
  const accent = isDeclined
    ? {
        icon: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
        badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/50',
        bar: 'from-red-400 to-red-500',
        label: 'Declined · High priority',
      }
    : {
        icon: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
        badge: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/50',
        bar: 'from-green-400 to-green-500',
        label: 'Approved',
      };

  return (
    <div
      className={`transform transition-all duration-500 ease-out ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className="min-w-80 max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-[#2D3B4E] dark:bg-[#1E293B]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 shadow-sm ${accent.icon}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h4 className="text-base font-semibold leading-tight text-gray-900 dark:text-white">
                {alert.title}
              </h4>
              <p className="mt-1 text-sm leading-snug text-gray-600 dark:text-gray-300">
                {alert.message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Dismiss approval notification"
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-medium ${accent.badge}`}>
              {accent.label}
            </span>
            {alert.route && (
              <button
                type="button"
                onClick={openJob}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                View Job
              </button>
            )}
          </div>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${accent.bar} transition-all ease-linear`}
              style={{
                width: isVisible ? '0%' : '100%',
                transitionDuration: isVisible ? `${displayDuration}ms` : '0ms',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
