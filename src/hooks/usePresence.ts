import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { presenceManager } from '../lib/presence';

export function usePresence() {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [onlineUsers, setOnlineUsers] = useState<Map<string, any>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  const updateOnlineUsers = useCallback((users?: Map<string, any>) => {
    const usersMap = users || new Map<string, any>();
    setOnlineUserIds(new Set(usersMap.keys()));
    setOnlineUsers(usersMap);
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
          .select('role, full_name')
          .eq('id', user.id)
          .single();
        
        const userRole = profileData?.role || 'user';
        
        await presenceManager.joinChannel(
          user.id,
          user.email || '',
          profileData?.full_name || user.user_metadata?.full_name || 'Name unavailable',
          userRole
        );

        if (mounted) {
          unsubscribePresence = presenceManager.subscribe((users) => {
            if (mounted) updateOnlineUsers(users);
          });
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Error setting up presence:', error);
      }
    };

    let unsubscribePresence: (() => void) | undefined;
    setupPresence();

    return () => {
      mounted = false;
      unsubscribePresence?.();
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
