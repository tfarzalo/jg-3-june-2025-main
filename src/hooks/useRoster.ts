import { useState, useEffect, useCallback, useRef } from 'react';
import { listUsersForRole, User } from '../services/roster';
import { usePresence } from './usePresence';

export interface RosterState {
  online: User[];
  offline: User[];
  loading: boolean;
}

export function useRoster(currentUserId: string, role: string) {
  const [state, setState] = useState<RosterState>({
    online: [],
    offline: [],
    loading: true
  });
  
  // Use the existing stable presence system
  const { onlineUserIds, isConnected } = usePresence();
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return;
    
    try {
      // Get users based on role
      const users = await listUsersForRole(currentUserId, role);
      
      // Split users into online/offline using the stable presence system
      const online = users.filter(user => onlineUserIds.has(user.id));
      const offline = users.filter(user => !onlineUserIds.has(user.id));
      
      if (mountedRef.current) {
        setState({
          online,
          offline,
          loading: false
        });
      }
    } catch (error) {
      console.error('Error refreshing roster:', error);
      if (mountedRef.current) {
        setState(prev => ({ ...prev, loading: false }));
      }
    }
  }, [currentUserId, role, onlineUserIds]);

  // Refresh when users or presence changes
  useEffect(() => {
    if (currentUserId && role && isConnected) {
      refresh();
    }
  }, [currentUserId, role, onlineUserIds, isConnected, refresh]);

  // Initial load
  useEffect(() => {
    if (currentUserId && role) {
      refresh();
    }
  }, [currentUserId, role]);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    ...state,
    refresh
  };
}
