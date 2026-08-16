import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import {
  getBellNotificationPreferenceKey,
  normalizeBellNotificationSettings,
  type BellNotificationSettings,
} from '../lib/notificationPreferences';

export interface Notification {
  id: string;
  user_id: string;
  activity_log_id: string;
  title: string;
  message: string;
  type: string;
  entity_id: string;
  is_read: boolean;
  metadata: Record<string, any>;
  created_at: string;
  creator_id?: string | null;
  creator_name?: string;
  creator_email?: string;
  activity_action?: string | null;
  activity_metadata?: Record<string, any> | null;
}

const filterVisibleNotifications = (
  notifications: Notification[],
  currentUserId: string,
  settings?: BellNotificationSettings
) =>
  notifications.filter((notification) => {
    if (notification.activity_log_id && notification.creator_id === currentUserId) return false;
    if (!settings) return true;
    return settings[getBellNotificationPreferenceKey(notification)] !== false;
  });

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user.id) {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      // Clear notifications and count before fetching to prevent stale data
      setNotifications([]);
      setUnreadCount(0);

      const [notificationsResult, unreadNotificationsResult, profileResult] = await Promise.all([
        supabase
          .from('notifications_view')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('notifications_view')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .range(0, 999),
        supabase
          .from('profiles')
          .select('notification_settings')
          .eq('id', session.user.id)
          .maybeSingle()
      ]);

      if (notificationsResult.error) throw notificationsResult.error;
      if (unreadNotificationsResult.error) throw unreadNotificationsResult.error;

      const settings = normalizeBellNotificationSettings(profileResult.data?.notification_settings);
      const notificationsData = filterVisibleNotifications(
        (notificationsResult.data || []) as Notification[],
        session.user.id,
        settings
      );
      const unreadNotificationsData = filterVisibleNotifications(
        (unreadNotificationsResult.data || []) as Notification[],
        session.user.id,
        settings
      );
      setNotifications(notificationsData);
      setUnreadCount(unreadNotificationsData.length);
      setError(null);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user.id) return;

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', session.user.id)
        .eq('is_read', false);

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, []);

  const dismissNotification = useCallback(async (notificationId: string) => {
    try {
      // Delete the notification so it does not return on refresh
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error dismissing notification:', err);
    }
  }, [markAsRead]);

  const clearAllNotifications = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user.id) return;

      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', session.user.id);

      if (error) throw error;

      setNotifications([]);
      setUnreadCount(0);
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Subscribe to new notifications for current user
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(() => {
      fetchNotifications();
    });

    // Subscribe to notifications table changes
    const channel = supabase
      .channel('user-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        async (payload) => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.user.id) return;

          const newNotification = payload.new as any;
          
          // Only add if it's for the current user
          if (newNotification.user_id === session.user.id) {
            // Fetch full notification details with joined data
            const { data } = await supabase
              .from('notifications_view')
              .select('*')
              .eq('id', newNotification.id)
              .single();

            const { data: profileData } = await supabase
              .from('profiles')
              .select('notification_settings')
              .eq('id', session.user.id)
              .maybeSingle();
            const settings = normalizeBellNotificationSettings(profileData?.notification_settings);

            if (data && !filterVisibleNotifications([data as Notification], session.user.id, settings).length) {
              return;
            }

            if (data) {
              setNotifications(prev => [data as Notification, ...prev]);
              setUnreadCount(prev => prev + 1);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          const updatedNotification = payload.new as any;
          setNotifications(prev => {
            const next = filterVisibleNotifications(
              prev.map(n => n.id === updatedNotification.id ? { ...n, ...updatedNotification } : n),
              updatedNotification.user_id
            );
            setUnreadCount(next.filter(n => !n.is_read).length);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      authSubscription?.unsubscribe();
      channel.unsubscribe();
    };
  }, [fetchNotifications]);

  return {
    notifications,
    loading,
    error,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAllNotifications,
    refetch: fetchNotifications
  };
}
