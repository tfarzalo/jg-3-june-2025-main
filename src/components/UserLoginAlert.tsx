import React, { useState, useEffect } from 'react';
import { User, X } from 'lucide-react';
import { useUserRole } from '../contexts/UserRoleContext';
import { getAvatarUrl } from '@/utils/supabase';

interface UserLoginAlertProps {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    avatar_url: string | null;
  };
  onClose: () => void;
}

export const UserLoginAlert = React.memo(function UserLoginAlert({ user, onClose }: UserLoginAlertProps) {
  const [isVisible, setIsVisible] = useState(false);
  const { role: currentUserRole } = useUserRole();

  // Add entrance animation delay for smooth slide-in
  useEffect(() => {
    const entranceTimer = setTimeout(() => {
      setIsVisible(true);
    }, 100);

    return () => clearTimeout(entranceTimer);
  }, []);

  // Auto-fade after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 700); // Wait for fade animation to complete
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  // Only show for admin and jg_management users
  if (currentUserRole !== 'admin' && currentUserRole !== 'jg_management') {
    return null;
  }

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };



  return (
    <div
      className={`transform transition-all duration-700 ease-out ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className="bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-[#2D3B4E] rounded-2xl shadow-2xl p-4 min-w-80 max-w-md">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            {/* User Avatar */}
            <div className="relative">
              {user.avatar_url ? (
                <img 
                  src={getAvatarUrl(user.avatar_url)}
                  alt={user.full_name || 'User'} 
                  className="w-12 h-12 rounded-full object-cover border-2 border-green-200 dark:border-green-800 shadow-sm"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              
              {/* Fallback avatar - shown if no avatar or if image fails to load */}
              <div className={`w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/40 dark:to-green-800/40 rounded-full flex items-center justify-center border-2 border-green-200 dark:border-green-800 shadow-sm ${user.avatar_url ? 'hidden' : ''}`}>
                <span className="text-green-700 dark:text-green-300 font-bold text-lg">
                  {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                </span>
              </div>
              
              {/* Online indicator dot */}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-[#1E293B] shadow-sm"></div>
            </div>
            
            {/* User Info */}
            <div className="min-w-0">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
                {user.full_name || 'Unnamed User'}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-tight mt-0.5">
                {user.email}
              </p>
            </div>
          </div>
          
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        {/* Footer Row */}
        <div className="flex items-center justify-between">
          {/* Role Badge */}
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-200 dark:border-blue-800/30">
              {user.role === 'jg_management' ? 'JG Management' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              just logged in
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-5000 ease-linear"
              style={{ width: isVisible ? '100%' : '0%' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
