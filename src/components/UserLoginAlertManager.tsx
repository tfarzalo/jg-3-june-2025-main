import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserLoginAlert } from './UserLoginAlert';
import { usePresence } from '../hooks/usePresence';
import { useUserRole } from '../contexts/UserRoleContext';
import { supabase } from '../utils/supabase';
import { useAuth } from '../contexts/AuthProvider';
import { getAvatarUrl } from '../utils/supabase';

interface LoginAlert {
  id: string;
  user: {
    id: string;
    email: string;
    full_name: string | null;
    role: string;
    avatar_url: string | null;
  };
  timestamp: number;
}

export function UserLoginAlertManager() {
  const [alerts, setAlerts] = useState<LoginAlert[]>([]);
  const { onlineUserIds, onlineUsers } = usePresence();
  const { role: currentUserRole } = useUserRole();
  const { user: currentUser } = useAuth();
  const previousOnlineUsers = useRef<Set<string>>(new Set());
  const alertCount = useRef(0);
  
  // Track which users we've already shown alerts for in this session
  const alertedUsers = useRef<Set<string>>(new Set());
  
  // Track when users were last alerted (daily tracking)
  const userAlertDates = useRef<Map<string, string>>(new Map());
  
  // Helper function to get today's date string (YYYY-MM-DD format)
  const getTodayString = (): string => {
    return new Date().toISOString().split('T')[0];
  };

  // Helper function to determine if we should show an alert for a user
  const shouldShowAlertForUser = (userId: string): boolean => {
    // Never show alerts for the current user
    if (userId === currentUser?.id) {
      return false;
    }
    
    const today = getTodayString();
    const lastAlertDate = userAlertDates.current.get(userId);
    
    // If we've never shown an alert for this user today, show it
    if (lastAlertDate !== today) {
      return true;
    }
    
    // Don't show alert if user already got an alert today
    return false;
  };

  useEffect(() => {
    // Check for new users coming online
    const newUsers = new Set<string>();
    onlineUserIds.forEach(userId => {
      if (!previousOnlineUsers.current.has(userId)) {
        newUsers.add(userId);
      }
    });

    // Check for users going offline
    const offlineUsers = new Set<string>();
    previousOnlineUsers.current.forEach(userId => {
      if (!onlineUserIds.has(userId)) {
        offlineUsers.add(userId);
      }
    });

    // Add alerts for new users (only if we haven't shown them today)
    if (newUsers.size > 0) {
      newUsers.forEach(async (userId) => {
        const userData = onlineUsers.get(userId);
        if (userData) {
          // Check if we should show an alert for this user
          const shouldShowAlert = shouldShowAlertForUser(userId);
          
          if (shouldShowAlert) {
            // Fetch complete user profile from database
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', userId)
                .single();
              
              const newAlert: LoginAlert = {
                id: `alert-${alertCount.current++}`,
                user: {
                  id: userId,
                  email: userData.email || 'user@example.com',
                  full_name: profileData?.full_name || userData.display_name || null,
                  role: userData.role || 'user',
                  avatar_url: profileData?.avatar_url || null
                },
                timestamp: Date.now()
              };
              
              setAlerts(prev => [...prev, newAlert]);
              // Mark this user as alerted for today
              alertedUsers.current.add(userId);
              userAlertDates.current.set(userId, getTodayString());
            } catch (error) {
              console.error('Error fetching user profile:', error);
              // Fallback to basic user data if profile fetch fails
              const newAlert: LoginAlert = {
                id: `alert-${alertCount.current++}`,
                user: {
                  id: userId,
                  email: userData.email || 'user@example.com',
                  full_name: userData.display_name || null,
                  role: userData.role || 'user',
                  avatar_url: null
                },
                timestamp: Date.now()
              };
              
              setAlerts(prev => [...prev, newAlert]);
              alertedUsers.current.add(userId);
              userAlertDates.current.set(userId, getTodayString());
            }
          }
        }
      });
    }

    // Update previous online users
    previousOnlineUsers.current = new Set(onlineUserIds);
  }, [onlineUserIds, onlineUsers, currentUser?.id]);

  const removeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  }, []);

  // Only show for admin and jg_management users
  if (currentUserRole !== 'admin' && currentUserRole !== 'jg_management') {
    return null;
  }

  // Limit the number of visible alerts to prevent screen clutter
  const visibleAlerts = alerts.slice(-3);

  return (
    <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-3">
      {visibleAlerts.map((alert, index) => (
        <div
          key={alert.id}
          className="transform transition-all duration-300 ease-out"
          style={{
            zIndex: 99999 - index
          }}
        >
          <UserLoginAlert
            user={alert.user}
            onClose={() => removeAlert(alert.id)}
          />
        </div>
      ))}
    </div>
  );
}
