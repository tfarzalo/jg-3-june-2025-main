import React from 'react';
import { formatDistanceToNow } from 'date-fns';

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

  // Construct proper avatar URL if avatar_url is just a filename
  const getAvatarUrl = (avatarUrl: string | null) => {
    if (!avatarUrl) return null;
    
    // If it's already a full URL, return as is
    if (avatarUrl.startsWith('http')) {
      return avatarUrl;
    }
    
    // If it's just a filename, construct the full Supabase storage URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/storage/v1/object/public/avatars/${avatarUrl}`;
  };

  const avatarUrl = getAvatarUrl(user.avatar_url);

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`relative flex-shrink-0 ${sizeClasses[size]} rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center overflow-hidden`}>
        {avatarUrl ? (
          <img 
            src={avatarUrl}
            alt={user.full_name || 'User'} 
            className={`${sizeClasses[size]} rounded-full object-cover`}
            onError={(e) => {
              // Fallback to initials if image fails to load
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        
        {/* Fallback initials - hidden if avatar image is displayed */}
        <span className={`text-blue-800 dark:text-blue-300 font-medium ${avatarUrl ? 'hidden' : ''}`}>
          {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
        </span>
        
        {/* Online/Offline status dot - positioned to be visible */}
        <div 
          className={`absolute -bottom-0.5 -right-0.5 ${dotSizeClasses[size]} rounded-full border-2 border-white dark:border-[#1E293B] ${
            isOnline ? 'bg-green-500' : 'bg-gray-400'
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
