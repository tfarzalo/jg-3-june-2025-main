import React, { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { getAvatarUrl } from '../../utils/supabase';

interface NewMessageToastProps {
  senderName: string;
  senderAvatar?: string | null;
  preview: string;
  conversationId: string;
  onClick: (conversationId: string) => void;
  onClose: () => void;
}

// Slide-in toast styled to match UserLoginAlert aesthetic
export function NewMessageToast({ senderName, senderAvatar, preview, conversationId, onClick, onClose }: NewMessageToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enterTimer = setTimeout(() => setVisible(true), 50);
    const exitTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 500);
    }, 5000);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, [onClose]);

  return (
    <div
      className={`transform transition-all duration-500 ease-out ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <button
        onClick={() => onClick(conversationId)}
        className="text-left bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#2D3B4E] rounded-2xl shadow-2xl p-4 min-w-80 max-w-md w-full hover:shadow-3xl transition-shadow"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              {senderAvatar ? (
                <img
                  src={getAvatarUrl(senderAvatar)}
                  alt={senderName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-blue-200 dark:border-blue-800 shadow-sm"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={`w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 rounded-full flex items-center justify-center border-2 border-blue-200 dark:border-blue-800 shadow-sm ${senderAvatar ? 'hidden' : ''}`}>
                <span className="text-blue-700 dark:text-blue-300 font-bold text-lg">
                  {senderName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-[#1E293B] shadow-sm"></div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">New message from {senderName}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-snug line-clamp-2">
                {preview}
              </p>
            </div>
          </div>
          <X
            className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            onClick={(e) => {
              e.stopPropagation();
              setVisible(false);
              setTimeout(onClose, 300);
            }}
          />
        </div>
      </button>
    </div>
  );
}
