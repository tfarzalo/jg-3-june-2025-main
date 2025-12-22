import { supabase } from '@/utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface ChatMessage {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  conversation_id: string;
}

export interface TypingEvent {
  event: 'typing';
  user_id: string;
  is_typing: boolean;
}

export interface PresenceEvent {
  event: 'presence';
  user_id: string;
  online: boolean;
  last_seen?: string;
}

export type ChatEvent = TypingEvent | PresenceEvent;

export interface ChatTopicCallbacks {
  onTyping?: (userId: string, isTyping: boolean) => void;
  onPresence?: (userId: string, online: boolean, lastSeen?: string) => void;
}

export interface ConversationSubscription {
  channel: RealtimeChannel;
  unsubscribe: () => void;
}

export interface ChatTopicSubscription {
  channel: RealtimeChannel;
  leave: () => void;
}

/**
 * Listen to conversation messages via database changes
 */
export function listenToConversation(
  conversationId: string,
  onInsert: (message: ChatMessage) => void
): ConversationSubscription {
  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onInsert(payload.new as ChatMessage);
      }
    )
    .subscribe();

  return {
    channel,
    unsubscribe: () => {
      channel.unsubscribe();
    },
  };
}

/**
 * Listen to user notifications
 */
export function listenToNotifications(
  userId: string,
  onNotify: (notification: any) => void
): ConversationSubscription {
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        onNotify(payload.new);
      }
    )
    .subscribe();

  return {
    channel,
    unsubscribe: () => {
      channel.unsubscribe();
    },
  };
}

/**
 * Join a private chat topic for real-time features like typing indicators and presence
 */
export function joinChatTopic(
  conversationId: string,
  userKey: string,
  callbacks: ChatTopicCallbacks = {}
): ChatTopicSubscription {
  const { onTyping, onPresence } = callbacks;

  const channel = supabase
    .channel(`chat:${conversationId}`, {
      config: { private: true },
    })
    .on('broadcast', { event: 'typing' }, (payload) => {
      if (onTyping && payload.payload.user_id !== userKey) {
        onTyping(payload.payload.user_id, payload.payload.is_typing);
      }
    })
    .on('broadcast', { event: 'presence' }, (payload) => {
      if (onPresence && payload.payload.user_id !== userKey) {
        onPresence(
          payload.payload.user_id,
          payload.payload.online,
          payload.payload.last_seen
        );
      }
    })
    .subscribe();

  return {
    channel,
    leave: () => {
      channel.unsubscribe();
    },
  };
}

/**
 * Set typing indicator for current user
 */
export function setTyping(
  conversationId: string,
  userId: string,
  isTyping: boolean
): void {
  supabase
    .channel(`chat:${conversationId}`)
    .send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        user_id: userId,
        is_typing: isTyping,
      },
    });
}

/**
 * Update presence status
 */
export function updatePresence(
  conversationId: string,
  userId: string,
  online: boolean,
  lastSeen?: string
): void {
  supabase
    .channel(`chat:${conversationId}`)
    .send({
      type: 'broadcast',
      event: 'presence',
      payload: {
        user_id: userId,
        online,
        last_seen: lastSeen || new Date().toISOString(),
      },
    });
}

/**
 * Track user as online in conversation
 */
export function trackOnline(conversationId: string, userId: string): void {
  updatePresence(conversationId, userId, true);
}

/**
 * Track user as offline in conversation
 */
export function trackOffline(conversationId: string, userId: string): void {
  updatePresence(conversationId, userId, false);
}
