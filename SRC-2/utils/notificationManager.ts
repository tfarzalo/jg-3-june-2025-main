import { supabase } from '../utils/supabase';

/**
 * Utility functions for notification management and real-time updates
 */

export class NotificationManager {
  private static instance: NotificationManager;
  private listeners: Set<() => void> = new Set();

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager();
    }
    return NotificationManager.instance;
  }

  /**
   * Add a listener for notification updates
   */
  addListener(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of notification changes
   */
  notifyListeners(): void {
    this.listeners.forEach(callback => callback());
  }

  /**
   * Manually trigger notification refresh for all listeners
   */
  refreshNotifications(): void {
    console.log('Manually refreshing notifications...');
    this.notifyListeners();
  }

  /**
   * Create a notification manually (for testing or backup)
   */
  async createNotification(
    userId: string,
    title: string,
    message: string,
    type: string = 'system',
    referenceId?: string,
    referenceType?: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_notifications')
        .insert({
          user_id: userId,
          title,
          message,
          type,
          reference_id: referenceId,
          reference_type: referenceType,
          is_read: false,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      
      // Notify listeners
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Error creating notification:', error);
      return false;
    }
  }

  /**
   * Force refresh of all data that might be affected by job phase changes
   */
  async forceRefreshJobData(): Promise<void> {
    try {
      // Dispatch custom events for job data refresh
      window.dispatchEvent(new CustomEvent('refreshJobData'));
      window.dispatchEvent(new CustomEvent('refreshNotifications'));
      
      // Also trigger listeners
      this.notifyListeners();
      
      console.log('Forced refresh of job data and notifications');
    } catch (error) {
      console.error('Error forcing refresh:', error);
    }
  }
}

/**
 * Hook for using notification manager in components
 */
export function useNotificationManager() {
  const manager = NotificationManager.getInstance();
  
  return {
    refreshNotifications: () => manager.refreshNotifications(),
    forceRefreshJobData: () => manager.forceRefreshJobData(),
    addListener: (callback: () => void) => manager.addListener(callback),
    createNotification: (
      userId: string,
      title: string,
      message: string,
      type?: string,
      referenceId?: string,
      referenceType?: string
    ) => manager.createNotification(userId, title, message, type, referenceId, referenceType)
  };
}
