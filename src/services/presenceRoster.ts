import { supabase } from '@/utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface PresenceClient {
  getState: () => Record<string, any>;
  leave: () => Promise<void>;
}

/**
 * Join users presence channel with graceful fallback
 */
export function joinUsersPresence(currentUserId: string): PresenceClient {
  try {
    const channel = supabase.channel('users:presence', { 
      config: { 
        presence: { key: currentUserId } 
      } 
    });

    // Set up presence event handlers
    channel
      .on('presence', { event: 'sync' }, (payload) => {
        console.log('Presence sync:', payload);
      })
      .on('presence', { event: 'join' }, (payload) => {
        console.log('User joined presence:', payload);
      })
      .on('presence', { event: 'leave' }, (payload) => {
        console.log('User left presence:', payload);
      });

    // Subscribe to the channel
    const subscription = channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Track current user as online
        channel.track({ 
          online_at: new Date().toISOString(),
          user_id: currentUserId
        });
      }
    });

    // Return presence client
    return {
      getState: () => channel.presenceState(),
      leave: async () => {
        try {
          await channel.untrack();
          supabase.removeChannel(channel);
        } catch (error) {
          console.warn('Error leaving presence channel:', error);
        }
      }
    };
  } catch (error) {
    console.warn('Failed to join presence channel, using fallback:', error);
    
    // Return no-op presence client as fallback
    return {
      getState: () => ({}),
      leave: async () => {}
    };
  }
}
