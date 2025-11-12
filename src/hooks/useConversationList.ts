import { useState, useEffect, useCallback } from 'react';
import { listMyDMs, ConversationSummary } from '@/services/roster';
import { supabase } from '@/utils/supabase';

export function useConversationList(currentUserId: string) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listMyDMs(currentUserId);
      setConversations(data);
    } catch (error) {
      console.error('Error refreshing conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;

    // Initial load
    refresh();

    // Subscribe to new messages to keep conversation list fresh
    const channel = supabase
      .channel('conversation-list-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // Refresh conversations when new message arrives
          refresh();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUserId, refresh]);

  return {
    conversations,
    loading,
    refresh
  };
}
