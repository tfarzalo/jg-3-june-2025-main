import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  Settings, 
  Sun, 
  Moon, 
  User, 
  LogOut,
  Calendar,
  Bell,
  X,
  Menu,
  ArrowRight,
  Activity as ActivityIcon,
  Clock
} from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { supabase, setupAvatarRefreshListener } from '../../utils/supabase';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthProvider';
import { useUserRole } from '../../contexts/UserRoleContext';
import { SearchOverlay } from '../SearchOverlay';
import { Button } from './Button';
import { NewChatModal } from '../chat/NewChatModal';
import { TestChatButton } from '../chat/TestChatButton';
import { ChatMenuEnhanced } from '../chat/ChatMenuEnhanced';
import { getAvatarProps } from '../../utils/avatarUtils';
import { useNotifications, Notification as UserNotification } from '../../hooks/useNotifications';
import { MobileNav } from '../mobile/MobileNav';

interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
}

interface TopbarProps {
  showOnlyProfile?: boolean;
}

function Topbar({ showOnlyProfile = false }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { session, signOut } = useAuth();
  const { role, isAdmin } = useUserRole();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAllNotifications,
    refetch: refetchNotifications
  } = useNotifications();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const notificationListRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [phaseMap, setPhaseMap] = useState<Record<string, { label: string; color: string }>>({});

  const isSubcontractor = role === 'subcontractor';

  useEffect(() => {
    const fetchProfile = async () => {
      if (session?.user.id) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (error) {
          console.error('Error fetching profile:', error);
        } else {
          setProfile(data);
        }
      }
    };

    fetchProfile();
  }, [session?.user.id]);

  // Add click outside listeners
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (session?.user.id && !isSubcontractor) {
      refetchNotifications();
    }
  }, [session?.user.id, isSubcontractor, refetchNotifications]);

  useEffect(() => {
    const fetchPhases = async () => {
      try {
        const { data, error } = await supabase
          .from('job_phases')
          .select('id, job_phase_label, color_dark_mode');

        if (error) throw error;

        const mapped = (data || []).reduce((acc, phase) => {
          acc[phase.id] = { label: phase.job_phase_label, color: phase.color_dark_mode };
          return acc;
        }, {} as Record<string, { label: string; color: string }>);

        setPhaseMap(mapped);
      } catch (err) {
        console.error('Error loading phase colors', err);
      }
    };

    fetchPhases();
  }, []);

  // Listen for avatar updates to refresh the profile
  useEffect(() => {
    const cleanup = setupAvatarRefreshListener((event) => {
      const { userId } = event.detail;
      
      // Refresh profile if the updated avatar belongs to the current user
      if (session?.user.id === userId) {
        console.log('Avatar updated for current user, refreshing profile...');
        // Re-fetch the profile to get the updated avatar
        const fetchProfile = async () => {
          if (session?.user.id) {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (error) {
              console.error('Error fetching profile:', error);
            } else {
              setProfile(data);
            }
          }
        };
        fetchProfile();
      }
    });

    return cleanup;
  }, [session?.user.id]);
  const handleNotificationClick = (notification: UserNotification) => {
    const meta = notification.metadata || {};
    const jobIdFromMeta = (meta as any)?.job_id;
    dismissNotification(notification.id);
    setNotificationOpen(false);
    if (jobIdFromMeta) {
      navigate(`/dashboard/jobs/${jobIdFromMeta}`);
    } else if (notification.entity_id && notification.type === 'job_phase_change') {
      navigate(`/dashboard/jobs/${notification.entity_id}`);
    } else if (notification.activity_log_id && notification.type === 'job_phase_change') {
      // Fallback to job_id in metadata if present
      const jobId = (notification.metadata as any)?.job_id;
      if (jobId) navigate(`/dashboard/jobs/${jobId}`);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    await markAsRead(notificationId);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
    toast.success('All notifications marked as read');
  };

  const removeNotification = async (notificationId: string) => {
    await dismissNotification(notificationId);
    toast.success('Notification dismissed');
  };

  const clearList = async () => {
    await clearAllNotifications();
    toast.success('Notification list cleared');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    }
  };

  // Add keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open search when '/' is pressed and no input is focused
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) {
        e.preventDefault();
        setSearchOpen(true);
      }
      // Close search when Escape is pressed
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
    }
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hr${hours !== 1 ? 's' : ''} ago`;
    }
    const days = Math.floor(diffInSeconds / 86400);
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatExactTime = (dateString: string) =>
    new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });

  const getPhaseMeta = (phaseId?: string, phaseName?: string) => {
    if (!phaseId && !phaseName) return null;
    const mapped = (phaseId && phaseMap[phaseId]) || null;
    return {
      label: mapped?.label || phaseName,
      color: mapped?.color || '#4B5563'
    };
  };

  return (
    <>
      <div className="h-16 bg-white dark:bg-[#0F172A] border-b border-gray-200 dark:border-[#1E293B] px-3 sm:px-4 lg:px-6 flex items-center justify-between">
        {/* Left side - Mobile menu button and logo */}
        <div className="flex items-center space-x-2 lg:space-x-4 min-w-0 flex-1">
          {/* Mobile menu button - only show on mobile for non-subcontractors */}
          {!isSubcontractor && !showOnlyProfile && (
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1E293B] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          )}

          {/* Logo - show for subcontractors or on mobile */}
          {(isSubcontractor || window.innerWidth < 1024) && (
            <div className="flex items-center flex-shrink-0">
              <img
                src="https://tbwtfimnbmvbgesidbxh.supabase.co/storage/v1/object/public/files/fb38963b-c67e-4924-860b-312045d19d2f/1750132407578_jg-logo-icon.png"
                alt="JG Painting"
                className="h-8 w-auto"
              />
            </div>
          )}

          {/* Desktop action buttons - hidden on mobile */}
          {!isSubcontractor && !showOnlyProfile && (
            <div className="hidden lg:flex items-center space-x-4">
              <button
                onClick={() => setSearchOpen(true)}
                className="relative w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-[#1E293B] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#2D3B4E] transition-colors"
                aria-label="Search"
              >
                <Search className="h-5 w-5" />
              </button>
              
              <button 
                onClick={() => navigate('/dashboard/sub-scheduler')}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-4 py-2 rounded-lg flex items-center transition-colors"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </button>
              <button 
                onClick={() => navigate('/dashboard/jobs/new')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Job
              </button>
              <button 
                onClick={() => navigate('/dashboard/properties/new')}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg flex items-center transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Property
              </button>
            </div>
          )}
        </div>

        {/* Right side - User info and controls */}
        <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4 flex-shrink-0">
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white p-2 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* Chat Menu - For all users including subcontractors */}
          <div className="touch-manipulation">
            <ChatMenuEnhanced />
          </div>

          {/* Notification Bell - Only show for non-subcontractors */}
          {!isSubcontractor && !showOnlyProfile && (
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="relative text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors p-2 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notificationOpen && (
                <div className="absolute right-0 mt-2 w-full sm:w-[480px] max-w-[calc(100vw-1rem)] sm:max-w-[480px] bg-white dark:bg-[#1E293B] rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-[#2D3B4E] flex items-center justify-between">
                    <h3 className="font-medium text-gray-900 dark:text-white text-base">Notifications</h3>
                    {notifications.length > 0 && (
                      <div className="flex items-center space-x-2 text-xs font-medium">
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap touch-manipulation py-2"
                        >
                          Mark all read
                        </button>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <button
                          onClick={clearList}
                          className="text-red-500 hover:underline whitespace-nowrap touch-manipulation py-2"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto" ref={notificationListRef}>
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-sm text-gray-500 dark:text-gray-400 text-center">
                        No notifications
                      </div>
                    ) : (
                      notifications.map(notification => {
                        const meta = notification.metadata || {};
                        const workOrderLabel = (meta as any)?.work_order_label;
                        const propertyName = (meta as any)?.property_name;
                        const unitNumber = (meta as any)?.unit_number;
                        const changeReason = (meta as any)?.change_reason;
                        const fromPhase = getPhaseMeta((meta as any)?.from_phase_id, (meta as any)?.from_phase_name);
                        const toPhase = getPhaseMeta((meta as any)?.to_phase_id, (meta as any)?.to_phase_name);
                        const actorName = notification.creator_name || 'System';

                        return (
                          <div
                            key={notification.id}
                            data-notification-id={notification.id}
                            data-unread={!notification.is_read ? 'true' : 'false'}
                            onClick={() => handleNotificationClick(notification)}
                            className={`relative cursor-pointer px-4 py-3 transition-colors border-b border-gray-100 dark:border-[#2D3B4E] ${
                              !notification.is_read
                                ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500'
                                : 'bg-white/70 dark:bg-[#1E293B] hover:bg-gray-50 dark:hover:bg-[#2D3B4E]'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                                <ActivityIcon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2 text-sm leading-snug">
                                    {workOrderLabel && (
                                      <span className="font-semibold text-gray-900 dark:text-white">
                                        {workOrderLabel}
                                      </span>
                                    )}
                                    {(propertyName || unitNumber) && (
                                      <span className="text-gray-700 dark:text-gray-300">
                                        {propertyName || 'Job'}{unitNumber ? ` • Unit ${unitNumber}` : ''}
                                      </span>
                                    )}
                                    {!workOrderLabel && !propertyName && (
                                      <span className="font-semibold text-gray-900 dark:text-white">
                                        {notification.title}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                    {formatRelativeTime(notification.created_at)}
                                  </span>
                                </div>

                                {notification.message && (
                                  <p className="text-sm text-gray-600 dark:text-gray-300 overflow-hidden text-ellipsis">
                                    {notification.message}
                                  </p>
                                )}

                                {fromPhase || toPhase ? (
                                  <div className="flex items-center gap-2 text-xs font-semibold">
                                    {fromPhase && (
                                      <span
                                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-white"
                                        style={{ backgroundColor: fromPhase.color }}
                                      >
                                        {fromPhase.label}
                                      </span>
                                    )}
                                    {fromPhase && toPhase && (
                                      <ArrowRight className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                    )}
                                    {toPhase && (
                                      <span
                                        className="inline-flex items-center rounded-full px-2.5 py-0.5 text-white"
                                        style={{ backgroundColor: toPhase.color }}
                                      >
                                        {toPhase.label}
                                      </span>
                                    )}
                                  </div>
                                ) : null}

                                {changeReason && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Reason: {changeReason}
                                  </p>
                                )}

                                <div className="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                                  <div className="flex items-center gap-2">
                                    <span className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      <span className="truncate max-w-[140px]">{actorName}</span>
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      <span>{formatExactTime(notification.created_at)}</span>
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {!notification.is_read && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          markNotificationAsRead(notification.id);
                                        }}
                                        className="text-blue-600 dark:text-blue-400 hover:underline"
                                      >
                                        Mark read
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeNotification(notification.id);
                                      }}
                                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                      aria-label="Remove notification"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User info and dropdown */}
          <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4 text-gray-500 dark:text-gray-400">
            <span className="text-sm hidden xl:block truncate max-w-[200px]">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </span>
            
            <div className="relative" ref={dropdownRef}>
              <div 
                className="flex items-center space-x-2 cursor-pointer touch-manipulation min-h-[44px] p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1E293B] transition-colors"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span className="text-gray-900 dark:text-white text-sm hidden sm:block truncate max-w-[120px]">
                  {profile?.full_name || session?.user.user_metadata.email?.split('@')[0] || 'User'}
                </span>
                {(() => {
                  const avatarProps = getAvatarProps({
                    avatar_url: profile?.avatar_url,
                    full_name: profile?.full_name,
                    email: session?.user.user_metadata.email
                  });
                  
                  return avatarProps.avatarUrl ? (
                    <img 
                      src={avatarProps.avatarUrl}
                      alt={profile?.full_name || 'User'} 
                      className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                      onError={(e) => {
                        // Fallback to initials if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `<div class="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">${avatarProps.initials}</div>`;
                        }
                      }}
                    />
                  ) : (
                    <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                      {avatarProps.initials}
                    </div>
                  );
                })()}
              </div>
              
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1E293B] rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-[#2D3B4E]">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {profile?.full_name || 'User'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {session?.user.user_metadata.email}
                    </p>
                  </div>
                  {!isSubcontractor && (
                    <>
                      <Link
                        to="/dashboard/profile"
                        className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2D3B4E] transition-colors touch-manipulation"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <User className="h-4 w-4 inline-block mr-2" />
                        Your Profile
                      </Link>
                      {isAdmin && (
                        <Link
                          to="/dashboard/settings"
                          className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2D3B4E] transition-colors touch-manipulation"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <Settings className="h-4 w-4 inline-block mr-2" />
                          Settings
                        </Link>
                      )}
                      <div className="border-t border-gray-200 dark:border-[#2D3B4E] my-1"></div>
                    </>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-[#2D3B4E] transition-colors touch-manipulation"
                  >
                    <LogOut className="h-4 w-4 inline-block mr-2" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay - iOS Style */}
      {mobileMenuOpen && !isSubcontractor && !showOnlyProfile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Mobile Menu Panel */}
          <div 
            ref={mobileMenuRef}
            className="fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-white dark:bg-[#0F172A] shadow-xl transform transition-transform overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-gray-200 dark:border-[#1E293B] bg-white dark:bg-[#0F172A]">
              <img
                src="https://tbwtfimnbmvbgesidbxh.supabase.co/storage/v1/object/public/files/fb38963b-c67e-4924-860b-312045d19d2f/1750132407578_jg-logo-icon.png"
                alt="JG Painting"
                className="h-8 w-auto"
              />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#1E293B] text-gray-500 dark:text-gray-400 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Navigation Items */}
            <div className="p-4 space-y-4">
              {/* Search */}
              <button
                onClick={() => {
                  setSearchOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B] rounded-lg transition-colors touch-manipulation min-h-[44px]"
              >
                <Search className="h-5 w-5 mr-3 flex-shrink-0" />
                <span className="truncate">Search</span>
              </button>

              {/* Quick Actions */}
              <div className="space-y-2 pb-4 border-b border-gray-200 dark:border-[#1E293B]">
                <div className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Quick Actions
                </div>
                <button 
                  onClick={() => {
                    navigate('/dashboard/sub-scheduler');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B] rounded-lg transition-colors touch-manipulation min-h-[44px]"
                >
                  <Calendar className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="truncate">Schedule</span>
                </button>
                
                <button 
                  onClick={() => {
                    navigate('/dashboard/jobs/new');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B] rounded-lg transition-colors touch-manipulation min-h-[44px]"
                >
                  <Plus className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="truncate">New Job</span>
                </button>
                
                <button 
                  onClick={() => {
                    navigate('/dashboard/properties/new');
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center px-4 py-3 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1E293B] rounded-lg transition-colors touch-manipulation min-h-[44px]"
                >
                  <Plus className="h-5 w-5 mr-3 flex-shrink-0" />
                  <span className="truncate">New Property</span>
                </button>
              </div>

              {/* Navigation Links */}
              <MobileNav onClose={() => setMobileMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

// Memoize Topbar to prevent unnecessary re-renders
export default Topbar;
