import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, Check, CheckCheck, Clock, Calendar, FileText, AlertTriangle } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { Link } from 'react-router-dom';
import { format, parseISO, isToday, isYesterday, isThisWeek } from 'date-fns';
import { toast } from 'sonner';
import { debounce } from '../lib/utils/debounce';

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'job_phase_change' | 'work_order' | 'callback' | 'system' | 'alert';
  reference_id?: string;
  reference_type?: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationSettings {
  job_phase_changes: boolean;
  work_orders: boolean;
  callbacks: boolean;
  system_alerts: boolean;
}

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    job_phase_changes: true,
    work_orders: true,
    callbacks: true,
    system_alerts: true
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const lastNotificationIdRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 5000; // Minimum time between fetches in milliseconds

  const fetchWithRetry = async <T,>(
    operation: () => Promise<T>,
    maxRetries = 5,
    initialDelay = 1000
  ): Promise<T> => {
    let attempt = 0;
    let delay = initialDelay;

    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        attempt++;
        
        if (attempt === maxRetries) {
          throw error;
        }

        const jitter = Math.random() * 1000;
        delay = Math.min(delay * 2 + jitter, 30000);
        
        console.log(`Retrying notification fetch in ${delay}ms... Attempt ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Max retry attempts reached');
  };

  const fetchNotifications = useCallback(async () => {
    // Prevent fetching too frequently
    const now = Date.now();
    if (now - lastFetchTimeRef.current < MIN_FETCH_INTERVAL) {
      return;
    }
    lastFetchTimeRef.current = now;
    
    try {
      setLoading(true);
      
      // Get current user
      const { data: userData, error: userError } = await fetchWithRetry(
        async () => await supabase.auth.getUser()
      );

      if (userError) throw userError;
      if (!userData.user) return;
      
      // Get notifications for current user
      const { data, error } = await fetchWithRetry(
        async () => await supabase
          .from('user_notifications')
          .select('*')
          .eq('user_id', userData.user.id)
          .order('created_at', { ascending: false })
          .limit(20)
      );
        
      if (error) throw error;
      
      if (isMountedRef.current) {
        // Check if there's a new notification
        if (data && data.length > 0 && lastNotificationIdRef.current !== data[0].id) {
          // If this isn't the first load and we have a new notification
          if (lastNotificationIdRef.current !== null && data[0].id !== lastNotificationIdRef.current) {
            // Show toast for new notification
            toast.info('New notification received', {
              description: data[0].title,
              duration: 4000,
            });
          }
          // Update the last notification ID
          lastNotificationIdRef.current = data[0].id;
        }
        
        setNotifications(data || []);
        
        // Count unread notifications
        const unread = data?.filter(notification => !notification.is_read).length || 0;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
      
      // Schedule a retry if mounted
      if (isMountedRef.current) {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        retryTimeoutRef.current = setTimeout(fetchNotifications, 5000);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Debounced version of fetchNotifications
  const debouncedFetchNotifications = useCallback(
    debounce(fetchNotifications, 1000),
    [fetchNotifications]
  );

  const fetchNotificationSettings = useCallback(async () => {
    try {
      // Get current user
      const { data: userData, error: userError } = await fetchWithRetry(
        async () => await supabase.auth.getUser()
      );

      if (userError) throw userError;
      if (!userData.user) return;
      
      // Get user profile with notification settings
      const { data, error } = await fetchWithRetry(
        async () => await supabase
          .from('profiles')
          .select('notification_settings')
          .eq('id', userData.user.id)
          .single()
      );
        
      if (error) {
        console.error('Error fetching notification settings:', error);
        return;
      }
      
      if (data?.notification_settings && isMountedRef.current) {
        try {
          const settings = JSON.parse(data.notification_settings);
          setNotificationSettings(settings);
        } catch (e) {
          console.error('Error parsing notification settings:', e);
        }
      }
    } catch (err) {
      console.error('Error fetching notification settings:', err);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    
    fetchNotifications();
    fetchNotificationSettings();

    // Set up real-time subscription for new notifications
    const notificationsSubscription = supabase
      .channel('notifications-changes')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'user_notifications' 
        }, 
        () => {
          if (isMountedRef.current) {
            debouncedFetchNotifications();
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for notification updates (marking as read)
    const notificationUpdatesSubscription = supabase
      .channel('notification-updates')
      .on('postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_notifications'
        },
        () => {
          if (isMountedRef.current) {
            debouncedFetchNotifications();
          }
        }
      )
      .subscribe();

    // Add click outside listener to close dropdown
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);

    // Set up polling for notifications as a fallback
    const pollingInterval = setInterval(() => {
      if (isMountedRef.current) {
        fetchNotifications();
      }
    }, 60000); // Poll every 60 seconds

    return () => {
      isMountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      notificationsSubscription.unsubscribe();
      notificationUpdatesSubscription.unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
      clearInterval(pollingInterval);
    };
  }, [fetchNotifications, fetchNotificationSettings, debouncedFetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await fetchWithRetry(
        async () => await supabase
          .from('user_notifications')
          .update({ is_read: true })
          .eq('id', id)
      );
        
      if (error) throw error;
      
      // Update local state
      setNotifications(notifications.map(notification => 
        notification.id === id ? { ...notification, is_read: true } : notification
      ));
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
      toast.error('Failed to mark notification as read. Please try again.');
    }
  };

  const markAllAsRead = async () => {
    try {
      // Get current user
      const { data: userData, error: userError } = await fetchWithRetry(
        async () => await supabase.auth.getUser()
      );

      if (userError) throw userError;
      if (!userData.user) return;
      
      const { error } = await fetchWithRetry(
        async () => await supabase
          .from('user_notifications')
          .update({ is_read: true })
          .eq('user_id', userData.user.id)
          .eq('is_read', false)
      );
        
      if (error) throw error;
      
      // Update local state
      setNotifications(notifications.map(notification => ({ ...notification, is_read: true })));
      setUnreadCount(0);
      
      toast.success('All notifications marked as read');
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      toast.error('Failed to mark all as read. Please try again.');
    }
  };

  const formatNotificationDate = (dateString: string) => {
    const date = parseISO(dateString);
    
    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    } else if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    } else if (isThisWeek(date)) {
      return format(date, 'EEEE at h:mm a');
    } else {
      return format(date, 'MMM d, yyyy');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'job_phase_change':
        return <FileText className="h-5 w-5 text-blue-500" />;
      case 'work_order':
        return <FileText className="h-5 w-5 text-orange-500" />;
      case 'callback':
        return <Calendar className="h-5 w-5 text-purple-500" />;
      case 'alert':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getNotificationLink = (notification: Notification) => {
    if (notification.reference_type === 'job' && notification.reference_id) {
      return `/dashboard/jobs/${notification.reference_id}`;
    }
    if (notification.reference_type === 'property' && notification.reference_id) {
      return `/dashboard/properties/${notification.reference_id}`;
    }
    return '#';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1E293B] rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-[#2D3B4E] flex justify-between items-center">
            <h3 className="font-medium text-gray-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all as read
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                <Bell className="h-8 w-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div>
                {notifications.map(notification => (
                  <div 
                    key={notification.id} 
                    className={`p-4 border-b border-gray-100 dark:border-[#2D3B4E] hover:bg-gray-50 dark:hover:bg-[#0F172A] transition-colors ${
                      !notification.is_read ? 'bg-blue-50 dark:bg-blue-900/10' : ''
                    }`}
                  >
                    <div className="flex">
                      <div className="flex-shrink-0 mr-3 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link 
                          to={getNotificationLink(notification)}
                          className="block"
                          onClick={() => {
                            if (!notification.is_read) {
                              markAsRead(notification.id);
                            }
                            setIsOpen(false);
                          }}
                        >
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-gray-500 dark:text-gray-500 flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatNotificationDate(notification.created_at)}
                            </p>
                            {!notification.is_read && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                }}
                                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Mark as read
                              </button>
                            )}
                          </div>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-3 border-t border-gray-200 dark:border-[#2D3B4E] text-center">
            <Link 
              to="/dashboard/settings"
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              onClick={() => setIsOpen(false)}
            >
              Notification Settings
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}