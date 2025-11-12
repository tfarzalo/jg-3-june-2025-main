import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import { useChatTray } from './ChatTrayProvider';
import { supabase } from '../utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UnreadMessagesContextType {
  unreadCount: number;
  unreadConversations: Set<string>;
  markAsRead: (conversationId: string) => void;
  markAllAsRead: () => void;
}

const UnreadMessagesContext = createContext<UnreadMessagesContextType | undefined>(undefined);

export const useUnreadMessages = () => {
  const context = useContext(UnreadMessagesContext);
  if (context === undefined) {
    throw new Error('useUnreadMessages must be used within an UnreadMessagesProvider');
  }
  return context;
};

interface Conversation {
  id: string;
  participants: string[];
  subject?: string;
  updated_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export const UnreadMessagesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { autoOpenChatForMessage } = useChatTray();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadConversations, setUnreadConversations] = useState<Set<string>>(new Set());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [users, setUsers] = useState<Map<string, { full_name: string | null; email: string }>>(new Map());

  // Load initial conversations and users
  useEffect(() => {
    const loadInitialData = async () => {
      if (!user?.id) return;

      try {
        // Load conversations
        const { data: conversationsData } = await supabase
          .from('conversations')
          .select('*')
          .contains('participants', [user.id]);

        if (conversationsData) {
          setConversations(conversationsData);
        }

        // Load users for display names
        const { data: usersData } = await supabase
          .from('profiles')
          .select('id, full_name, email');

        if (usersData) {
          const usersMap = new Map();
          usersData.forEach(user => {
            usersMap.set(user.id, { full_name: user.full_name, email: user.email });
          });
          setUsers(usersMap);
        }
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };

    loadInitialData();
  }, [user?.id]);

  // Set up real-time subscriptions for new messages
  useEffect(() => {
    if (!user?.id) return;

    let messagesChannel: RealtimeChannel;

    const setupRealtime = async () => {
      // Subscribe to new messages
      messagesChannel = supabase
        .channel('unread-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `sender_id=neq.${user.id}` // Only messages not from current user
          },
          async (payload) => {
            console.log('New message received in UnreadMessagesProvider:', payload);
            const newMessage = payload.new as Message;
            
            // Increment unread count
            setUnreadCount(prev => prev + 1);
            
            // Add conversation to unread set
            setUnreadConversations(prev => new Set(prev).add(newMessage.conversation_id));

            // Find the conversation and sender details
            const conversation = conversations.find(c => c.id === newMessage.conversation_id);
            if (conversation) {
              // Find the sender (other participant)
              const senderId = conversation.participants.find(id => id !== user.id);
              if (senderId) {
                const sender = users.get(senderId);
                const senderName = sender?.full_name || sender?.email || 'Unknown User';
                
                // Auto-open chat window for new messages
                autoOpenChatForMessage(newMessage.conversation_id, senderName);
              }
            }
          }
        )
        .subscribe();

      // Subscribe to conversation updates
      const conversationsChannel = supabase
        .channel('conversation-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'conversations',
            filter: `participants=cs.{${user.id}}`
          },
          (payload) => {
            console.log('Conversation updated:', payload);
            const updatedConversation = payload.new as Conversation;
            
            // Update conversations list
            setConversations(prev => 
              prev.map(conv => 
                conv.id === updatedConversation.id ? updatedConversation : conv
              )
            );
          }
        )
        .subscribe();

      // Subscribe to new conversations
      const newConversationsChannel = supabase
        .channel('new-conversations')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'conversations',
            filter: `participants=cs.{${user.id}}`
          },
          (payload) => {
            console.log('New conversation created:', payload);
            const newConversation = payload.new as Conversation;
            
            // Add to conversations list
            setConversations(prev => [newConversation, ...prev]);
          }
        )
        .subscribe();

      return () => {
        // Cleanup subscriptions
        if (messagesChannel) {
          supabase.removeChannel(messagesChannel);
        }
        if (conversationsChannel) {
          supabase.removeChannel(conversationsChannel);
        }
        if (newConversationsChannel) {
          supabase.removeChannel(newConversationsChannel);
        }
      };
    };

    setupRealtime();

    return () => {
      if (messagesChannel) {
        supabase.removeChannel(messagesChannel);
      }
    };
  }, [user?.id, conversations, users, autoOpenChatForMessage]);

  // Mark conversation as read
  const markAsRead = (conversationId: string) => {
    setUnreadConversations(prev => {
      const newSet = new Set(prev);
      newSet.delete(conversationId);
      return newSet;
    });
    
    // Decrement unread count if this conversation was unread
    if (unreadConversations.has(conversationId)) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  // Mark all conversations as read
  const markAllAsRead = () => {
    setUnreadConversations(new Set());
    setUnreadCount(0);
  };

  const value: UnreadMessagesContextType = {
    unreadCount,
    unreadConversations,
    markAsRead,
    markAllAsRead,
  };

  return (
    <UnreadMessagesContext.Provider value={value}>
      {children}
    </UnreadMessagesContext.Provider>
  );
};
