import React from 'react';
import { User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getAvatarUrl } from '@/utils/supabase';

interface UserChipProps {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    last_seen: string | null;
  };
  isOnline: boolean;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function UserChip({ 
  user, 
  isOnline, 
  showTooltip = true, 
  size = 'md',
  className = '' 
}: UserChipProps) {
  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-10 w-10 text-base'
  };

  const dotSizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3'
  };

  const getStatusText = () => {
    if (isOnline) {
      return 'Currently Online';
    }
    
    if (!user.last_seen) {
      return 'Never seen';
    }
    
    try {
      return `Last seen ${formatDistanceToNow(new Date(user.last_seen), { addSuffix: true })}`;
    } catch {
      return 'Last seen recently';
    }
  };

  const statusText = getStatusText();

  // Determine border color based on online status
  const borderColor = isOnline 
    ? 'border-green-500 dark:border-green-400' 
    : 'border-red-500 dark:border-red-400';

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      <div className={`relative flex-shrink-0 ${sizeClasses[size]} rounded-full overflow-hidden border-2 ${borderColor} shadow-sm`}>
        {user.avatar_url ? (
          <img 
            src={getAvatarUrl(user.avatar_url)}
            alt={user.full_name || 'User'} 
            className={`${sizeClasses[size]} rounded-full object-cover`}
            onError={(e) => {
              // Fallback to icon if image fails to load
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        
        {/* Fallback avatar - shown if no avatar or if image fails to load */}
        <div className={`${sizeClasses[size]} bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center ${user.avatar_url ? 'hidden' : ''}`}>
          <User className={`text-gray-600 dark:text-gray-300 ${size === 'sm' ? 'h-3 w-3' : size === 'md' ? 'h-4 w-4' : 'h-5 w-5'}`} />
        </div>
        
        {/* Online/Offline status dot - positioned to be visible and match alert styling */}
        <div 
          className={`absolute -bottom-1 -right-1 ${dotSizeClasses[size]} rounded-full border-2 border-white dark:border-[#1E293B] shadow-sm ${
            isOnline ? 'bg-green-500' : 'bg-red-500'
          }`}
        />
      </div>
      
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {user.full_name || 'Unnamed User'}
        </span>
        
        {showTooltip && (
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate" title={statusText}>
            {statusText}
          </span>
        )}
      </div>
    </div>
  );
}
