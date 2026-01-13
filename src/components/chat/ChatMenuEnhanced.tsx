import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Plus, X, ArrowLeft, Search, Send } from 'lucide-react';
import { useChatTray } from '../../contexts/ChatTrayProvider';
import { useAuth } from '../../contexts/AuthProvider';
import { supabase, getAvatarUrl } from '../../utils/supabase';
import { getAvatarProps } from '../../utils/avatarUtils';
import { toast } from 'sonner';
import { useUnreadMessages } from '../../contexts/UnreadMessagesProvider';
import { RealtimeChannel } from '@supabase/supabase-js';
import { EnhancedChatApi } from '../../services/enhancedChatApi';

interface ChatUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string | null;
  role?: string;
}

interface Conversation {
  id: string;
  participants: string[];
  subject?: string | null;
  updated_at: string;
  created_at?: string;
  archived?: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: ChatUser;
}

type ViewMode = 'list' | 'chat' | 'userSelect' | 'subjectPrompt';

export function ChatMenuEnhanced() {
  const { user } = useAuth();
  const { openChats, openChat, closeChat, setTitle } = useChatTray();
  const { unreadCount, markAsRead, unreadConversations } = useUnreadMessages();
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatTitles, setChatTitles] = useState<Record<string, string>>({});
  const [chatUsers, setChatUsers] = useState<Record<string, ChatUser>>({});
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const [lastMessages, setLastMessages] = useState<Record<string, { body: string; created_at: string; sender_id: string }>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // New chat state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [allUsers, setAllUsers] = useState<ChatUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [chatSubject, setChatSubject] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  
  // Chat view state
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesChannelRef = useRef<RealtimeChannel | null>(null);

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    // Format as date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Helper function to get conversation last message preview
  const getConversationLastMessage = (conversationId: string) => {
    const lastMsg = lastMessages[conversationId];
    if (!lastMsg) return 'No messages yet';
    
    const isOwnMessage = lastMsg.sender_id === user?.id;
    const prefix = isOwnMessage ? 'You: ' : '';
    const truncatedBody = lastMsg.body.length > 40 ? lastMsg.body.substring(0, 40) + '...' : lastMsg.body;
    return `${prefix}${truncatedBody}`;
  };

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load current user's role
  useEffect(() => {
    const loadCurrentUserRole = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (!error && data) {
          setCurrentUserRole(data.role);
        }
      } catch (error) {
        console.error('Error loading user role:', error);
      }
    };

    loadCurrentUserRole();
  }, [user?.id]);

  // Load all available users based on role
  useEffect(() => {
    const loadAllUsers = async () => {
      if (!user?.id || !currentUserRole) return;
      
      setIsLoadingUsers(true);
      try {
        let query = supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url, role')
          .neq('id', user.id);

        // Apply role restrictions for subcontractors
        if (currentUserRole === 'subcontractor') {
          query = query.in('role', ['admin', 'jg_management']);
        }

        const { data, error } = await query;

        if (error) {
          console.error('[ChatMenuEnhanced] Error loading users:', error);
        } else {
          setAllUsers(data || []);
          console.log('[ChatMenuEnhanced] Loaded users:', data?.length || 0);
        }
      } catch (error) {
        console.error('[ChatMenuEnhanced] Error loading users:', error);
      } finally {
        setIsLoadingUsers(false);
      }
    };

    loadAllUsers();
  }, [user?.id, currentUserRole]);

  // Load ALL conversations for the user (not just openChats)
  // Also reload when dropdown opens
  useEffect(() => {
    const loadAllConversations = async () => {
      if (!user?.id) return;

      console.log('[ChatMenuEnhanced] Loading conversations for user:', user.id, 'Dropdown open:', isOpen);

      try {
        const { data: conversationsData, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .contains('participants', [user.id])
          .or('archived.is.null,archived.eq.false') // Only load non-archived conversations
          .order('updated_at', { ascending: false });

        if (convError) {
          console.error('[ChatMenuEnhanced] Error loading conversations:', convError);
          return;
        }

        console.log('[ChatMenuEnhanced] Loaded conversations:', conversationsData?.length || 0);
        setAllConversations(conversationsData || []);

        // Load user info for each conversation
        for (const conversation of conversationsData || []) {
          const otherParticipantId = conversation.participants.find((id: string) => id !== user.id);
          
          if (otherParticipantId) {
            const { data: participantData, error: participantError } = await supabase
              .from('profiles')
              .select('id, email, full_name, avatar_url')
              .eq('id', otherParticipantId)
              .single();

            if (!participantError && participantData) {
              setChatUsers(prev => ({ ...prev, [conversation.id]: participantData }));
              
              const title = conversation.subject 
                ? `${participantData.full_name || participantData.email} - ${conversation.subject}`
                : participantData.full_name || participantData.email;
              setChatTitles(prev => ({ ...prev, [conversation.id]: title }));
            }
          }
        }
      } catch (error) {
        console.error('[ChatMenuEnhanced] Error loading all conversations:', error);
      }
    };

    loadAllConversations();
  }, [user?.id, isOpen]); // Added isOpen to refresh when dropdown opens

  // Load last messages for all conversations
  useEffect(() => {
    const loadLastMessages = async () => {
      if (!user?.id || allConversations.length === 0) return;
      
      try {
        for (const conversation of allConversations) {
          const { data: lastMessageData } = await supabase
            .from('messages')
            .select('id, body, created_at, sender_id')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          if (lastMessageData) {
            setLastMessages(prev => ({
              ...prev,
              [conversation.id]: lastMessageData
            }));
          }
        }
      } catch (error) {
        console.error('[ChatMenuEnhanced] Error loading last messages:', error);
      }
    };

    loadLastMessages();
  }, [allConversations, user?.id]);

  // Ensure user info is loaded for any conversations added after the initial fetch
  useEffect(() => {
    const loadMissingConversationUsers = async () => {
      if (!user?.id || allConversations.length === 0) return;

      const missingConversations = allConversations.filter(conv => !chatUsers[conv.id]);
      if (missingConversations.length === 0) {
        return;
      }

      for (const conversation of missingConversations) {
        const otherParticipantId = conversation.participants.find((id: string) => id !== user.id);
        if (!otherParticipantId) continue;

        try {
          const { data: participantData, error: participantError } = await supabase
            .from('profiles')
            .select('id, email, full_name, avatar_url')
            .eq('id', otherParticipantId)
            .single();

          if (!participantError && participantData) {
            setChatUsers(prev => ({ ...prev, [conversation.id]: participantData }));

            const title = conversation.subject
              ? `${participantData.full_name || participantData.email} - ${conversation.subject}`
              : participantData.full_name || participantData.email;
            setChatTitles(prev => ({ ...prev, [conversation.id]: title }));
          }
        } catch (error) {
          console.error(`Error loading participant for conversation ${conversation.id}:`, error);
        }
      }
    };

    loadMissingConversationUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allConversations, user?.id]);

  // Load chat info for open chats (legacy support)
  useEffect(() => {
    const loadChatInfo = async () => {
      if (!user?.id || openChats.length === 0) return;

      try {
        for (const chat of openChats) {
          if (chatTitles[chat.id]) continue; // Skip if already loaded
          
          try {
            const { data: conversationData, error: convError } = await supabase
              .from('conversations')
              .select('*')
              .eq('id', chat.id)
              .single();

            if (convError) throw convError;

            const otherParticipantId = conversationData.participants.find((id: string) => id !== user.id);
            
            if (otherParticipantId) {
              const { data: participantData, error: participantError } = await supabase
                .from('profiles')
                .select('id, email, full_name, avatar_url')
                .eq('id', otherParticipantId)
                .single();

              if (!participantError && participantData) {
                setChatUsers(prev => ({ ...prev, [chat.id]: participantData }));
                
                const title = conversationData.subject 
                  ? `${participantData.full_name || participantData.email} - ${conversationData.subject}`
                  : participantData.full_name || participantData.email;
                setChatTitles(prev => ({ ...prev, [chat.id]: title }));
              }
            }
          } catch (error) {
            console.error(`Error loading chat ${chat.id}:`, error);
          }
        }
      } catch (error) {
        console.error('Error loading chat info:', error);
      }
    };

    loadChatInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openChats.map(c => c.id).join(','), user?.id]);

  // Search users from the loaded list
  useEffect(() => {
    if (!searchQuery.trim() || viewMode !== 'userSelect') {
      setSearchResults([]);
      return;
    }

    const searchUsers = () => {
      setIsSearching(true);
      try {
        const query = searchQuery.toLowerCase();
        const filtered = allUsers.filter(u => 
          u.email.toLowerCase().includes(query) || 
          u.full_name?.toLowerCase().includes(query)
        ).slice(0, 20);
        
        setSearchResults(filtered);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, allUsers, viewMode]);

  // Real-time subscription for conversation updates and new messages
  useEffect(() => {
    if (!user?.id) return;

    console.log('[ChatMenuEnhanced] Setting up real-time subscriptions for user:', user.id);

    const conversationsChannel = supabase
      .channel('chat-menu-conversations')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'conversations',
        filter: `participants=cs.{${user.id}}`
      }, (payload) => {
        console.log('[ChatMenuEnhanced] New conversation created:', payload);
        const newConversation = payload.new as Conversation;
        setAllConversations(prev => [newConversation, ...prev]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'conversations',
        filter: `participants=cs.{${user.id}}`
      }, (payload) => {
        console.log('[ChatMenuEnhanced] Conversation updated:', payload);
        const updatedConversation = payload.new as Conversation;
        setAllConversations(prev => {
          const exists = prev.some(conv => conv.id === updatedConversation.id);

          // Remove archived conversations from the quick menu
          if (updatedConversation.archived) {
            console.log('[ChatMenuEnhanced] Removing archived conversation:', updatedConversation.id);
            return prev.filter(conv => conv.id !== updatedConversation.id);
          }

          if (exists) {
            // Move updated conversation to top of list
            console.log('[ChatMenuEnhanced] Moving updated conversation to top:', updatedConversation.id);
            const filtered = prev.filter(conv => conv.id !== updatedConversation.id);
            return [updatedConversation, ...filtered];
          }

          // Conversation may have been unarchived elsewhere; add it to the list
          console.log('[ChatMenuEnhanced] Adding unarchived conversation:', updatedConversation.id);
          return [updatedConversation, ...prev];
        });
      })
      .subscribe((status) => {
        console.log('[ChatMenuEnhanced] Conversations channel status:', status);
      });

    // Subscribe to new messages to update conversation order in real-time
    const messagesChannel = supabase
      .channel('chat-menu-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, async (payload) => {
        const newMessage = payload.new as Message;
        console.log('[ChatMenuEnhanced] New message received:', newMessage);
        
        // Update last message for this conversation
        setLastMessages(prev => ({
          ...prev,
          [newMessage.conversation_id]: {
            body: newMessage.body,
            created_at: newMessage.created_at,
            sender_id: newMessage.sender_id
          }
        }));
        
        // First, check if this message is in a conversation the user is part of
        const { data: conversationData } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', newMessage.conversation_id)
          .single();
        
        // Only process if user is a participant
        if (!conversationData || !conversationData.participants.includes(user.id)) {
          console.log('[ChatMenuEnhanced] Message not for current user, ignoring');
          return;
        }
        
        console.log('[ChatMenuEnhanced] Message is for current user, updating conversations');
        
        // Update the conversation's updated_at timestamp and move it to the top
        setAllConversations(prev => {
          const conversationIndex = prev.findIndex(conv => conv.id === newMessage.conversation_id);
          
          if (conversationIndex !== -1) {
            // Conversation exists in list - update it and move to top
            const conversation = prev[conversationIndex];
            const updatedConversation = {
              ...conversation,
              updated_at: newMessage.created_at
            };
            
            console.log('[ChatMenuEnhanced] Moving conversation to top:', updatedConversation.id);
            
            // Remove the conversation from its current position and add it to the top
            const filtered = prev.filter(conv => conv.id !== newMessage.conversation_id);
            return [updatedConversation, ...filtered];
          } else {
            // Conversation not in list - add it if not archived
            if (!conversationData.archived) {
              console.log('[ChatMenuEnhanced] Adding new conversation to list:', conversationData.id);
              return [conversationData, ...prev];
            }
          }
          
          return prev;
        });
      })
      .subscribe((status) => {
        console.log('[ChatMenuEnhanced] Messages channel status:', status);
      });

    return () => {
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [user?.id]);

  // Load messages when chat is selected
  useEffect(() => {
    if (!isOpen || viewMode !== 'chat' || !selectedChatId || !user?.id) {
      console.log('Skipping message load:', { viewMode, selectedChatId, userId: user?.id });
      return;
    }

    console.log('Loading messages for chat:', selectedChatId);
    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const { data: messagesData, error } = await supabase
          .from('messages')
          .select(`
            *,
            sender:profiles!messages_sender_id_fkey(
              id,
              full_name,
              email,
              avatar_url
            )
          `)
          .eq('conversation_id', selectedChatId)
          .order('created_at', { ascending: true });
        
        if (error) {
          console.error('Error loading messages:', error);
          throw error;
        }
        
        console.log('Messages loaded:', messagesData?.length || 0);
        setMessages(messagesData || []);
        markAsRead(selectedChatId);
      } catch (error) {
        console.error('Failed to load messages:', error);
        toast.error('Failed to load messages');
        setMessages([]); // Set empty array on error
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatId, viewMode, user?.id, isOpen]);

  // Real-time message subscription
  useEffect(() => {
    if (!isOpen || viewMode !== 'chat' || !selectedChatId || !user?.id) return;

    const channel = supabase
      .channel(`messages:${selectedChatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selectedChatId}`
      }, async (payload) => {
        const newMsg = payload.new as Message;
        
        // Load sender info
        const { data: senderData } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .eq('id', newMsg.sender_id)
          .single();
        
        if (senderData) {
          newMsg.sender = senderData;
        }
        
        setMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m.id === newMsg.id)) {
            return prev;
          }
          return [...prev, newMsg];
        });
        
        if (newMsg.sender_id !== user.id) {
          markAsRead(selectedChatId);
        }
      })
      .subscribe();

    messagesChannelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatId, viewMode, user?.id, isOpen]);

  // Handler functions
  const handleStartNewChat = () => {
    setSearchQuery('');
    setSelectedUser(null);
    setChatSubject('');
    setViewMode('userSelect');
  };

  const handleSelectUser = (selectedUser: ChatUser) => {
    setSelectedUser(selectedUser);
    setViewMode('subjectPrompt');
  };

  const handleCreateChat = async () => {
    if (!user?.id || !selectedUser) return;

    try {
      const { data: newConversation, error } = await supabase
        .from('conversations')
        .insert({
          participants: [user.id, selectedUser.id],
          type: 'direct',
          subject: chatSubject.trim() || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;

      // Register chat
      openChat(newConversation.id);
      const title = chatSubject.trim()
        ? `${selectedUser.full_name || selectedUser.email} - ${chatSubject}`
        : selectedUser.full_name || selectedUser.email;
      setTitle(newConversation.id, title);
      
      // Load chat info
      setChatUsers(prev => ({ ...prev, [newConversation.id]: selectedUser }));
      setChatTitles(prev => ({ ...prev, [newConversation.id]: title }));

      // Open chat view
      setSelectedChatId(newConversation.id);
      setViewMode('chat');
      
      toast.success('Chat created successfully');
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to create chat');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedChatId || !user?.id || sending) {
      console.log('Cannot send message:', { 
        hasMessage: !!newMessage.trim(), 
        selectedChatId, 
        userId: user?.id, 
        sending 
      });
      return;
    }

    console.log('Sending message to chat:', selectedChatId);
    setSending(true);
    const messageText = newMessage.trim();
    setNewMessage(''); // Clear immediately for better UX
    
    try {
      const { data: insertedMessage, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedChatId,
          sender_id: user.id,
          body: messageText,
          created_at: new Date().toISOString()
        })
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .single();

      if (error) {
        console.error('Database error sending message:', error);
        throw error;
      }

      console.log('Message sent successfully:', insertedMessage?.id);

      // Add message to local state immediately (real-time will handle it too, but this is faster)
      if (insertedMessage) {
        setMessages(prev => {
          // Check if message already exists (from real-time)
          if (prev.some(m => m.id === insertedMessage.id)) {
            console.log('Message already exists in state');
            return prev;
          }
          return [...prev, insertedMessage as Message];
        });
      }

      // Update conversation timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedChatId);

    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      setNewMessage(messageText); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const handleArchiveConversation = async (conversationId: string) => {
    try {
      console.log('Archiving conversation:', conversationId);
      
      // Archive the conversation in the database
      await EnhancedChatApi.archiveConversation(conversationId);
      
      // Remove from local state
      setAllConversations(prev => prev.filter(conv => conv.id !== conversationId));
      
      // Close the chat from openChats
      closeChat(conversationId);
      
      // If this was the selected conversation, go back to list
      if (selectedChatId === conversationId) {
        handleBackToList();
      }
      
      toast.success('Conversation archived');
    } catch (error) {
      console.error('Error archiving conversation:', error);
      toast.error('Failed to archive conversation');
    }
  };

  const handleOpenChat = (chatId: string) => {
    console.log('Opening chat:', chatId);
    setMessages([]); // Clear messages before switching
    setLoadingMessages(false); // Reset loading state
    setSelectedChatId(chatId);
    setViewMode('chat');
    // Mark as read when opening the chat
    markAsRead(chatId);
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedChatId(null);
    setMessages([]);
    setLoadingMessages(false);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Chat Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors p-2"
        aria-label="Open chats"
      >
        <MessageCircle className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#1E293B] rounded-lg shadow-xl z-50 overflow-hidden border border-gray-200 dark:border-[#2D3B4E]">
          
          {/* LIST VIEW */}
          {viewMode === 'list' && (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-200 dark:border-[#2D3B4E] flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
                <h3 className="font-semibold text-white">Chats</h3>
                <button
                  onClick={handleStartNewChat}
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                  title="Start new chat"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {/* Chat List */}
              <div className="max-h-96 overflow-y-auto">
                {allConversations.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">No conversations</p>
                    <button
                      onClick={handleStartNewChat}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Start a conversation
                    </button>
                  </div>
                ) : (
                  // Sort chats: unread messages first, then by most recent message timestamp
                  [...allConversations]
                    .sort((a, b) => {
                      const aUnread = unreadConversations.has(a.id);
                      const bUnread = unreadConversations.has(b.id);
                      if (aUnread && !bUnread) return -1;
                      if (!aUnread && bUnread) return 1;
                      
                      // Sort by last message timestamp if available, otherwise by updated_at
                      const aTimestamp = lastMessages[a.id]?.created_at || a.updated_at;
                      const bTimestamp = lastMessages[b.id]?.created_at || b.updated_at;
                      return new Date(bTimestamp).getTime() - new Date(aTimestamp).getTime();
                    })
                    .map(conversation => {
                    const chatUser = chatUsers[conversation.id];
                    const avatarProps = chatUser ? getAvatarProps(chatUser) : null;
                    const hasUnread = unreadConversations.has(conversation.id);
                    
                    return (
                      <div
                        key={conversation.id}
                        className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors cursor-pointer border-l-4 ${
                          hasUnread ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-transparent'
                        }`}
                        onClick={() => handleOpenChat(conversation.id)}
                      >
                        <div className="flex items-center space-x-3">
                          {/* Avatar */}
                          <div className="flex-shrink-0">
                            {avatarProps?.avatarUrl ? (
                              <img
                                src={avatarProps.avatarUrl}
                                alt={chatUser?.full_name || 'User'}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                                {avatarProps?.initials || 'U'}
                              </div>
                            )}
                          </div>

                          {/* Chat Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
                                {chatTitles[conversation.id] || 'Loading...'}
                              </p>
                              {/* Timestamp */}
                              {lastMessages[conversation.id] && (
                                <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0">
                                  {formatTimestamp(lastMessages[conversation.id].created_at)}
                                </span>
                              )}
                            </div>
                            {hasUnread ? (
                              <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                New messages
                              </p>
                            ) : (
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {getConversationLastMessage(conversation.id)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* USER SELECT VIEW */}
          {viewMode === 'userSelect' && (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-200 dark:border-[#2D3B4E] flex items-center space-x-3 bg-gradient-to-r from-blue-600 to-blue-700">
                <button
                  onClick={() => setViewMode('list')}
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h3 className="font-semibold text-white">Select User</h3>
              </div>

              {/* Search */}
              <div className="p-4 border-b border-gray-200 dark:border-[#2D3B4E]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-[#2D3B4E] rounded-lg bg-white dark:bg-[#2D3B4E] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* User List */}
              <div className="max-h-80 overflow-y-auto">
                {isLoadingUsers ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Loading users...
                  </div>
                ) : isSearching ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Searching...
                  </div>
                ) : (
                  // Show search results if searching, otherwise show all users
                  (searchQuery.trim() ? searchResults : allUsers).length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                      {searchQuery ? 'No users found' : 'No users available'}
                    </div>
                  ) : (
                    (searchQuery.trim() ? searchResults : allUsers).map(searchUser => {
                      const avatarProps = getAvatarProps(searchUser);
                      return (
                        <div
                          key={searchUser.id}
                          onClick={() => handleSelectUser(searchUser)}
                          className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors cursor-pointer"
                        >
                          <div className="flex items-center space-x-3">
                            {avatarProps.avatarUrl ? (
                              <img
                                src={avatarProps.avatarUrl}
                                alt={searchUser.full_name || 'User'}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                                {avatarProps.initials}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {searchUser.full_name || searchUser.email}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {searchUser.email}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </>
          )}

          {/* SUBJECT PROMPT VIEW */}
          {viewMode === 'subjectPrompt' && selectedUser && (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-200 dark:border-[#2D3B4E] flex items-center space-x-3 bg-gradient-to-r from-blue-600 to-blue-700">
                <button
                  onClick={() => setViewMode('userSelect')}
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h3 className="font-semibold text-white">Chat Subject</h3>
              </div>

              {/* Selected User Info */}
              <div className="px-4 py-4 border-b border-gray-200 dark:border-[#2D3B4E] bg-gray-50 dark:bg-[#2D3B4E]">
                <div className="flex items-center space-x-3">
                  {getAvatarProps(selectedUser).avatarUrl ? (
                    <img
                      src={getAvatarProps(selectedUser).avatarUrl!}
                      alt={selectedUser.full_name || 'User'}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                      {getAvatarProps(selectedUser).initials}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {selectedUser.full_name || selectedUser.email}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedUser.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Subject Input */}
              <div className="p-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subject (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Project discussion, Question about..."
                  value={chatSubject}
                  onChange={(e) => setChatSubject(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateChat();
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-[#2D3B4E] rounded-lg bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Press Enter or click Start Chat to continue
                </p>
              </div>

              {/* Actions */}
              <div className="px-4 pb-4 flex space-x-2">
                <button
                  onClick={() => setViewMode('userSelect')}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateChat}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Start Chat
                </button>
              </div>
            </>
          )}

          {/* CHAT VIEW */}
          {viewMode === 'chat' && selectedChatId && (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-gray-200 dark:border-[#2D3B4E] flex items-center space-x-3 bg-gradient-to-r from-blue-600 to-blue-700">
                <button
                  onClick={handleBackToList}
                  className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">
                    {chatTitles[selectedChatId] || 'Chat'}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="h-96 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-[#0F172A]">
                {loadingMessages ? (
                  <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                    Loading messages...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
                    No messages yet. Start the conversation!
                  </div>
                ) : (
                  messages.map((message) => {
                    const isOwnMessage = message.sender_id === user.id;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
                          {!isOwnMessage && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 px-3">
                              {message.sender?.full_name || message.sender?.email || 'Unknown'}
                            </p>
                          )}
                          <div
                            className={`px-4 py-2 rounded-2xl ${
                              isOwnMessage
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-white dark:bg-[#1E293B] text-gray-900 dark:text-white rounded-bl-none'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                          </div>
                          <p className={`text-xs text-gray-400 mt-1 px-3 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
                            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200 dark:border-[#2D3B4E]">
                <div className="flex items-end space-x-2">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    rows={2}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-[#2D3B4E] rounded-lg bg-white dark:bg-[#0F172A] text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
                    title="Send message"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
