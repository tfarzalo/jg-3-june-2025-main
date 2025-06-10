import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Plus, 
  Settings, 
  Building2, 
  ClipboardList, 
  Home, 
  Sun, 
  Moon, 
  User, 
  LogOut,
  Calendar,
  Bell,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { useUserRole } from '../../hooks/useUserRole';
import type { Profile } from '../../lib/supabase';
import { SearchOverlay } from '../SearchOverlay';
import { Button } from './Button';

interface Notification {
  id: string;
  type: 'job_status_change' | 'new_job_request';
  title: string;
  message: string;
  created_at: string;
  read: boolean;
  job_id?: string;
}

interface TopbarProps {
  showOnlyProfile?: boolean;
}

export function Topbar({ showOnlyProfile = false }: TopbarProps) {
  const { theme, toggleTheme } = useTheme();
  const { session, signOut } = useAuth();
  const { role } = useUserRole();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

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
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch notifications only for non-subcontractors
  useEffect(() => {
    if (session?.user.id && !isSubcontractor) {
      fetchNotifications();
      
      // Subscribe to new notifications
      const channel = supabase
        .channel('notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${session.user.id}`
          },
          (payload) => {
            const newNotification = payload.new as Notification;
            setNotifications(prev => [newNotification, ...prev]);
            setUnreadCount(prev => prev + 1);
            toast.info(newNotification.message);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session?.user.id, isSubcontractor]);

  const fetchNotifications = async () => {
    if (!session?.user.id) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    setNotifications(data || []);
    setUnreadCount(data?.filter(n => !n.read).length || 0);
  };

  const handleNotificationClick = (notification: Notification) => {
    markNotificationAsRead(notification.id);
    setNotificationOpen(false);
    
    if (notification.job_id) {
      navigate(`/dashboard/jobs/${notification.job_id}`);
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return;
    }

    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
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

  return (
    <>
      <div className="h-16 bg-white dark:bg-[#0F172A] border-b border-gray-200 dark:border-[#1E293B] px-6 flex items-center justify-between">
        {/* Left side - Logo and buttons */}
        <div className="flex items-center space-x-4">
          {/* Logo - only show for subcontractors */}
          {isSubcontractor && (
            <div className="flex items-center">
              <img
                src="https://obpigateacucxhunpyqc.supabase.co/storage/v1/object/public/files/fb38963b-c67e-4924-860b-312045d19d2f/1749521668533_jg-logo-1.png"
                alt="JG Painting"
                className="h-8 w-auto"
              />
            </div>
          )}

          {/* Action buttons - only show for non-subcontractors */}
          {!isSubcontractor && !showOnlyProfile && (
            <>
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
            </>
          )}
        </div>

        {/* Right side - User info and controls */}
        <div className="flex items-center space-x-6">
          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          {/* Notification Bell - Only show for non-subcontractors */}
          {!isSubcontractor && !showOnlyProfile && (
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setNotificationOpen(!notificationOpen)}
                className="relative text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notificationOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1E293B] rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-[#2D3B4E]">
                    <h3 className="font-medium text-gray-900 dark:text-white">Notifications</h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                        No notifications
                      </div>
                    ) : (
                      notifications.map(notification => (
                        <button
                          key={notification.id}
                          onClick={() => handleNotificationClick(notification)}
                          className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors ${
                            !notification.read ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                          }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-shrink-0 mt-1">
                              {notification.type === 'job_status_change' ? (
                                <CheckCircle className="h-5 w-5 text-blue-500" />
                              ) : (
                                <AlertCircle className="h-5 w-5 text-orange-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                {new Date(notification.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* User info and dropdown */}
          <div className="flex items-center space-x-4 text-gray-500 dark:text-gray-400">
            <span className="text-sm hidden md:block">
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </span>
            
            <div className="relative" ref={dropdownRef}>
              <div 
                className="flex items-center space-x-2 cursor-pointer"
                onClick={() => setDropdownOpen(!dropdownOpen)}
              >
                <span className="text-gray-900 dark:text-white text-sm hidden md:block">
                  {profile?.full_name || session?.user.user_metadata.email?.split('@')[0] || 'User'}
                </span>
                {profile?.avatar_url ? (
                  <img 
                    src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar_url}`}
                    alt={profile?.full_name || 'User'} 
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {profile?.full_name 
                      ? profile.full_name.charAt(0).toUpperCase() 
                      : session?.user.user_metadata.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
              
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#1E293B] rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-[#2D3B4E]">
                    <p className="font-medium text-gray-900 dark:text-white">
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
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2D3B4E]"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <User className="h-4 w-4 inline-block mr-2" />
                        Your Profile
                      </Link>
                      <Link
                        to="/dashboard/settings"
                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2D3B4E]"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <Settings className="h-4 w-4 inline-block mr-2" />
                        Settings
                      </Link>
                      <div className="border-t border-gray-200 dark:border-[#2D3B4E] my-1"></div>
                    </>
                  )}
                  <button
                    onClick={handleSignOut}
                    disabled={loggingOut}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-[#2D3B4E] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <LogOut className="h-4 w-4 inline-block mr-2" />
                    {loggingOut ? 'Signing out...' : 'Sign out'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
