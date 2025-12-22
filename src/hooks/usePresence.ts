import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { presenceManager } from '../lib/presence';

export function usePresence() {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<Map<string, any>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  const updateOnlineUsers = useCallback(() => {
    const channel = presenceManager.getChannel();
    if (channel) {
      const presenceState = channel.presenceState();
      const onlineIds = new Set<string>();
      const usersMap = new Map<string, any>();
      
      Object.entries(presenceState).forEach(([userId, presenceData]) => {
        onlineIds.add(userId);
        if (presenceData && presenceData.length > 0) {
          usersMap.set(userId, presenceData[0]);
        }
      });
      
      setOnlineUserIds(onlineIds);
      setOnlineUsers(usersMap);
    }
  }, []);

  const isOnline = useCallback((userId: string) => {
    return onlineUserIds.has(userId);
  }, [onlineUserIds]);

  useEffect(() => {
    let mounted = true;

    const setupPresence = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mounted) return;

        // Get user role from profiles table
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        const userRole = profileData?.role || 'user';
        
        const channel = await presenceManager.joinChannel(
          user.id,
          user.email || '',
          user.user_metadata?.full_name || user.email || '',
          userRole
        );

        if (mounted) {
          channel.on('presence', { event: 'sync' }, () => {
            if (mounted) {
              updateOnlineUsers();
            }
          });

          channel.on('presence', { event: 'join' }, () => {
            if (mounted) {
              updateOnlineUsers();
            }
          });

          channel.on('presence', { event: 'leave' }, () => {
            if (mounted) {
              updateOnlineUsers();
            }
          });

          setIsConnected(true);
        }
      } catch (error) {
        console.error('Error setting up presence:', error);
      }
    };

    setupPresence();

    return () => {
      mounted = false;
      presenceManager.leaveChannel();
      setIsConnected(false);
    };
  }, [updateOnlineUsers]);

  return {
    onlineUserIds,
    onlineUsers,
    isOnline,
    isConnected,
    updateOnlineUsers,
  };
}
