import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthProvider';
import { useChatTray } from './ChatTrayProvider';
import { supabase } from '../utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UnreadMessagesContextType {
  unreadCount: number;
  unreadConversations: Set<string>;
  markAsRead: (conversationId: string) => void;
  markAllAsRead: () => void;
  refreshUnreadCount: () => Promise<void>;
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
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Force re-render trigger

  // Function to calculate unread count for the current user
  const calculateUnreadCount = useCallback(async () => {
    if (!user?.id) return;

    console.log('[UnreadMessagesProvider] Calculating unread count for user:', user.id);

    try {
      // Load conversations
      const { data: conversationsData } = await supabase
        .from('conversations')
        .select('*')
        .contains('participants', [user.id])
        .or('archived.is.null,archived.eq.false'); // Only non-archived conversations

      if (conversationsData) {
        setConversations(conversationsData);
        
        // Calculate initial unread count
        let totalUnread = 0;
        const unreadConvSet = new Set<string>();
        
        for (const conv of conversationsData) {
          // Get all messages in this conversation that were sent by others
          const { data: allMessages } = await supabase
            .from('messages')
            .select('id')
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id);
          
          if (!allMessages || allMessages.length === 0) continue;
          
          // Get all messages this user has read in this conversation
          const { data: readMessages } = await supabase
            .from('message_reads')
            .select('message_id')
            .eq('conversation_id', conv.id)
            .eq('user_id', user.id);
          
          const readMessageIds = new Set(readMessages?.map(r => r.message_id) || []);
          
          // Count unread messages (messages not in the read set)
          const unreadInConv = allMessages.filter(msg => !readMessageIds.has(msg.id)).length;
          
          if (unreadInConv > 0) {
            totalUnread += unreadInConv;
            unreadConvSet.add(conv.id);
          }
        }
        
        setUnreadCount(totalUnread);
        setUnreadConversations(unreadConvSet);
        setRefreshTrigger(prev => prev + 1); // Force re-render
        console.log(`[UnreadMessagesProvider] Unread count calculated: ${totalUnread} messages across ${unreadConvSet.size} conversations`);
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
      console.error('[UnreadMessagesProvider] Error calculating unread count:', error);
    }
  }, [user?.id]);

  // Load initial conversations and users, and calculate unread count
  useEffect(() => {
    calculateUnreadCount();
  }, [calculateUnreadCount]);

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
            console.log('[UnreadMessagesProvider] New message received:', payload);
            const newMessage = payload.new as Message;
            
            // Fetch fresh conversation to check if user is a participant
            try {
              const { data: conversationData, error: conversationError } = await supabase
                .from('conversations')
                .select('*')
                .eq('id', newMessage.conversation_id)
                .single();

              if (conversationError || !conversationData) {
                console.error('[UnreadMessagesProvider] Error fetching conversation:', conversationError);
                return;
              }

              if (conversationData.participants.includes(user.id)) {
                console.log('[UnreadMessagesProvider] User is participant, incrementing unread count');
                
                // If someone archived the conversation, unarchive it so it can appear in menus again
                if (conversationData.archived) {
                  const { error: unarchiveError } = await supabase
                    .from('conversations')
                    .update({ archived: false })
                    .eq('id', conversationData.id);

                  if (unarchiveError) {
                    console.error('[UnreadMessagesProvider] Error unarchiving:', unarchiveError);
                  } else {
                    console.log('[UnreadMessagesProvider] Unarchived conversation:', conversationData.id);
                    conversationData.archived = false;
                  }
                }

                // User is a participant - increment unread count
                setUnreadCount(prev => {
                  const newCount = prev + 1;
                  console.log('[UnreadMessagesProvider] Unread count updated:', prev, '->', newCount);
                  return newCount;
                });
                
                // Add conversation to unread set and force re-render
                setUnreadConversations(prev => {
                  const newSet = new Set(prev);
                  newSet.add(newMessage.conversation_id);
                  console.log('[UnreadMessagesProvider] Unread conversations:', Array.from(newSet));
                  return newSet;
                });
                
                // Force re-render to ensure components update
                setRefreshTrigger(t => t + 1);

                // Find the sender (other participant)
                const senderId = conversationData.participants.find((id: string) => id !== user.id);
                if (senderId) {
                  const { data: senderData } = await supabase
                    .from('profiles')
                    .select('full_name, email')
                    .eq('id', senderId)
                    .single();

                  const senderName = senderData?.full_name || senderData?.email || 'Unknown User';
                  
                  console.log('[UnreadMessagesProvider] Auto-opening chat for:', senderName);
                  // Auto-open chat window for new messages
                  autoOpenChatForMessage(newMessage.conversation_id, senderName);
                }
              } else {
                console.log('[UnreadMessagesProvider] User is not a participant, ignoring');
              }
            } catch (error) {
              console.error('[UnreadMessagesProvider] Error processing message:', error);
            }
          }
        )
        .subscribe((status) => {
          console.log('[UnreadMessagesProvider] Subscription status:', status);
        });

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

      // Subscribe to message_reads to sync unread counts across tabs/devices
      const messageReadsChannel = supabase
        .channel('message-reads-sync')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'message_reads',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('[UnreadMessagesProvider] Message marked as read:', payload);
            const readReceipt = payload.new as { conversation_id: string; message_id: string };
            
            // Decrement unread count
            setUnreadCount(prev => {
              const newCount = Math.max(0, prev - 1);
              console.log(`[UnreadMessagesProvider] Unread count decremented: ${prev} -> ${newCount}`);
              return newCount;
            });
            
            // Check if there are any remaining unread messages in this conversation
            const checkUnreadInConversation = async () => {
              const { data: unreadMessages } = await supabase
                .from('messages')
                .select('id')
                .eq('conversation_id', readReceipt.conversation_id)
                .neq('sender_id', user.id);
              
              if (!unreadMessages || unreadMessages.length === 0) {
                // No messages from others - remove from unread
                setUnreadConversations(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(readReceipt.conversation_id);
                  setRefreshTrigger(t => t + 1); // Force re-render
                  return newSet;
                });
                return;
              }
              
              const { data: readMessages } = await supabase
                .from('message_reads')
                .select('message_id')
                .eq('conversation_id', readReceipt.conversation_id)
                .eq('user_id', user.id);
              
              const readMessageIds = new Set(readMessages?.map(r => r.message_id) || []);
              const stillUnread = unreadMessages.some(msg => !readMessageIds.has(msg.id));
              
              if (!stillUnread) {
                // No more unread messages in this conversation
                console.log(`[UnreadMessagesProvider] All messages read in conversation: ${readReceipt.conversation_id}`);
                setUnreadConversations(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(readReceipt.conversation_id);
                  setRefreshTrigger(t => t + 1); // Force re-render
                  return newSet;
                });
              }
            };
            
            checkUnreadInConversation();
          }
        )
        .subscribe();

      return () => {
        // Cleanup subscriptions
        supabase.removeChannel(messagesChannel);
        supabase.removeChannel(conversationsChannel);
        supabase.removeChannel(newConversationsChannel);
        supabase.removeChannel(messageReadsChannel);
      };
    };

    setupRealtime();
  }, [user?.id, autoOpenChatForMessage]);

  // Mark conversation as read
  const markAsRead = useCallback(async (conversationId: string) => {
    if (!user?.id) return;
    
    console.log('[UnreadMessagesProvider] Marking conversation as read:', conversationId);
    
    try {
      // Get all unread messages in this conversation (sent by others)
      const { data: unreadMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id);
      
      if (!unreadMessages || unreadMessages.length === 0) {
        console.log('[UnreadMessagesProvider] No messages to mark as read');
        return;
      }
      
      // Get already read messages
      const { data: readMessages } = await supabase
        .from('message_reads')
        .select('message_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
      
      const readMessageIds = new Set(readMessages?.map(r => r.message_id) || []);
      
      // Filter to only unread messages
      const messagesToMarkAsRead = unreadMessages.filter(msg => !readMessageIds.has(msg.id));
      
      if (messagesToMarkAsRead.length === 0) {
        console.log('[UnreadMessagesProvider] All messages already marked as read');
        // Still update local state in case it's out of sync
        setUnreadConversations(prev => {
          const newSet = new Set(prev);
          newSet.delete(conversationId);
          setRefreshTrigger(t => t + 1); // Force re-render
          return newSet;
        });
        return;
      }
      
      console.log(`[UnreadMessagesProvider] Marking ${messagesToMarkAsRead.length} messages as read`);
      
      // Create read receipts for all unread messages
      const readReceipts = messagesToMarkAsRead.map(msg => ({
        conversation_id: conversationId,
        message_id: msg.id,
        user_id: user.id,
        read_at: new Date().toISOString()
      }));
      
      const { error } = await supabase
        .from('message_reads')
        .insert(readReceipts);
      
      if (error) {
        console.error('[UnreadMessagesProvider] Error marking messages as read:', error);
        return;
      }
      
      // Update local state
      setUnreadConversations(prev => {
        const newSet = new Set(prev);
        const wasUnread = newSet.has(conversationId);
        
        if (wasUnread) {
          newSet.delete(conversationId);
          // Decrement unread count by the number of messages marked as read
          setUnreadCount(prevCount => {
            const newCount = Math.max(0, prevCount - messagesToMarkAsRead.length);
            console.log(`[UnreadMessagesProvider] Unread count: ${prevCount} -> ${newCount}`);
            return newCount;
          });
          console.log(`[UnreadMessagesProvider] Conversation marked as read, decremented count by ${messagesToMarkAsRead.length}`);
        }
        
        setRefreshTrigger(t => t + 1); // Force re-render
        return newSet;
      });
    } catch (error) {
      console.error('[UnreadMessagesProvider] Error in markAsRead:', error);
    }
  }, [user?.id]);

  // Mark all conversations as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    
    console.log('[UnreadMessagesProvider] Marking all conversations as read');
    
    try {
      // Get all conversations for this user
      const { data: userConversations } = await supabase
        .from('conversations')
        .select('id')
        .contains('participants', [user.id]);
      
      if (!userConversations || userConversations.length === 0) {
        setUnreadConversations(new Set());
        setUnreadCount(0);
        setRefreshTrigger(t => t + 1); // Force re-render
        return;
      }
      
      const conversationIds = userConversations.map(c => c.id);
      
      // Get all unread messages across all conversations
      const { data: allMessages } = await supabase
        .from('messages')
        .select('id, conversation_id')
        .in('conversation_id', conversationIds)
        .neq('sender_id', user.id);
      
      if (!allMessages || allMessages.length === 0) {
        setUnreadConversations(new Set());
        setUnreadCount(0);
        setRefreshTrigger(t => t + 1); // Force re-render
        return;
      }
      
      // Get already read messages
      const { data: readMessages } = await supabase
        .from('message_reads')
        .select('message_id')
        .in('conversation_id', conversationIds)
        .eq('user_id', user.id);
      
      const readMessageIds = new Set(readMessages?.map(r => r.message_id) || []);
      
      // Filter to only unread messages
      const messagesToMarkAsRead = allMessages.filter(msg => !readMessageIds.has(msg.id));
      
      if (messagesToMarkAsRead.length === 0) {
        setUnreadConversations(new Set());
        setUnreadCount(0);
        setRefreshTrigger(t => t + 1); // Force re-render
        return;
      }
      
      // Create read receipts for all unread messages
      const readReceipts = messagesToMarkAsRead.map(msg => ({
        conversation_id: msg.conversation_id,
        message_id: msg.id,
        user_id: user.id,
        read_at: new Date().toISOString()
      }));
      
      const { error } = await supabase
        .from('message_reads')
        .insert(readReceipts);
      
      if (error) {
        console.error('[UnreadMessagesProvider] Error marking all messages as read:', error);
        return;
      }
      
      // Update local state
      setUnreadConversations(new Set());
      setUnreadCount(0);
      setRefreshTrigger(t => t + 1); // Force re-render
      console.log(`[UnreadMessagesProvider] Marked ${messagesToMarkAsRead.length} messages as read across all conversations`);
    } catch (error) {
      console.error('[UnreadMessagesProvider] Error in markAllAsRead:', error);
    }
  }, [user?.id]);

  const value: UnreadMessagesContextType = useMemo(() => ({
    unreadCount,
    unreadConversations,
    markAsRead,
    markAllAsRead,
    refreshUnreadCount: calculateUnreadCount,
  }), [unreadCount, unreadConversations, markAsRead, markAllAsRead, calculateUnreadCount, refreshTrigger]); // Include refreshTrigger to force updates

  return (
    <UnreadMessagesContext.Provider value={value}>
      {children}
    </UnreadMessagesContext.Provider>
  );
};
