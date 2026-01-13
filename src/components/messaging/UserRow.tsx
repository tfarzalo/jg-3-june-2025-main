import React from 'react';
import { User } from '../../services/roster';

interface UserRowProps {
  user: User;
  unread?: number;
  lastMessage?: string;
  onClick: () => void;
}

export function UserRow({ user, unread = 0, lastMessage, onClick }: UserRowProps) {
  const displayName = user.full_name || user.email || user.id.slice(0, 8);
  const hasUnread = unread > 0;

  return (
    <div
      onClick={onClick}
      className="flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors"
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={displayName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
            <span className="text-gray-600 dark:text-gray-300 font-medium text-sm">
              {displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="font-medium text-gray-900 dark:text-white truncate">
            {displayName}
          </div>
          {hasUnread && (
            <div className="flex-shrink-0 ml-2">
              <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                {unread > 99 ? '99+' : unread}
              </span>
            </div>
          )}
        </div>
        
        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
          {user.role}
        </div>
        
        {lastMessage && (
          <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1">
            {lastMessage}
          </div>
        )}
      </div>
    </div>
  );
}
