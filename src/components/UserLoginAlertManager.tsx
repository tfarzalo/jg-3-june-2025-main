import React, { useState, useEffect, useRef } from 'react';
import { UserLoginAlert } from './UserLoginAlert';
import { usePresence } from '../hooks/usePresence';
import { useUserRole } from '../contexts/UserRoleContext';
import { supabase } from '../utils/supabase';

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
  const previousOnlineUsers = useRef<Set<string>>(new Set());
  const alertCount = useRef(0);
  
  // Track which users we've already shown alerts for in this session
  const alertedUsers = useRef<Set<string>>(new Set());
  
  // Track when users went offline for cooldown calculation (3 hours = 3 * 60 * 60 * 1000 ms)
  const userOfflineTimes = useRef<Map<string, number>>(new Map());
  const COOLDOWN_DURATION = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

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
        // Record when user went offline
        userOfflineTimes.current.set(userId, Date.now());
      }
    });

    // Add alerts for new users (only if we haven't shown them recently)
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
              // Mark this user as alerted for this session
              alertedUsers.current.add(userId);
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
            }
          }
        }
      });
    }

    // Update previous online users
    previousOnlineUsers.current = new Set(onlineUserIds);
  }, [onlineUserIds, onlineUsers]);

  // Helper function to determine if we should show an alert for a user
  const shouldShowAlertForUser = (userId: string): boolean => {
    // If we've never shown an alert for this user, show it
    if (!alertedUsers.current.has(userId)) {
      return true;
    }
    
    // Check if enough time has passed since they went offline (cooldown period)
    const offlineTime = userOfflineTimes.current.get(userId);
    if (offlineTime) {
      const timeSinceOffline = Date.now() - offlineTime;
      if (timeSinceOffline >= COOLDOWN_DURATION) {
        // Reset the alert status for this user after cooldown
        alertedUsers.current.delete(userId);
        userOfflineTimes.current.delete(userId);
        return true;
      }
    }
    
    // Don't show alert if user is still in cooldown period
    return false;
  };

  const removeAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId));
  };

  // Only show for admin and jg_management users
  if (currentUserRole !== 'admin' && currentUserRole !== 'jg_management') {
    return null;
  }

  // Limit the number of visible alerts to prevent screen clutter
  const visibleAlerts = alerts.slice(-3);

  return (
    <div className="fixed top-4 right-4 z-[99999] space-y-3">
      {visibleAlerts.map((alert, index) => (
        <div
          key={alert.id}
          style={{
            transform: `translateY(${index * 20}px)`,
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
