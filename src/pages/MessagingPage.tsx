import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthProvider';
import { useUnreadMessages } from '../contexts/UnreadMessagesProvider';
import { useChatTray } from '../contexts/ChatTrayProvider';
import { useUserRole } from '../contexts/UserRoleContext';
import { MessageCircle, Settings, Users, Plus, Search, Send, MoreVertical, Phone, Expand, ArrowLeft, Archive, ArchiveRestore, Trash2, Clock } from 'lucide-react';
import { supabase, getAvatarUrl } from '../utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ChatDock } from '../components/chat/ChatDock';
import { EnhancedChatApi } from '../services/enhancedChatApi';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  last_seen?: string;
  is_online?: boolean;
  phone?: string;
  avatar_url?: string | null;
}

interface Conversation {
  id: string;
  participants: string[];
  type: string;
  subject?: string;
  archived?: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  deleted_by?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: User;
}

function MessagingPage() {
  const { user, initializing } = useAuth();
  const { markAsRead } = useUnreadMessages();
  const { openChat, openChats } = useChatTray();
  const { isSubcontractor } = useUserRole();
  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'chats' | 'users' | 'archived' | 'deleted'>('chats');
  const [unreadConversations, setUnreadConversations] = useState<Set<string>>(new Set());
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatSubject, setNewChatSubject] = useState('');
  const [selectedUserForChat, setSelectedUserForChat] = useState<User | null>(null);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [deletedConversations, setDeletedConversations] = useState<Conversation[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [editingSubject, setEditingSubject] = useState(false);
  const [editSubjectValue, setEditSubjectValue] = useState('');
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  
  // Real-time subscription references
  const messagesChannelRef = useRef<RealtimeChannel | null>(null);
  const conversationsChannelRef = useRef<RealtimeChannel | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Function to scroll to bottom of messages
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 10);
    }
  };

  // Auto-scroll to bottom when new messages arrive (iPhone-style)
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          scrollToBottom();
        }, 50);
      });
    }
  }, [messages]);

  // Close chat options dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showChatOptions && !target.closest('[data-dropdown]')) {
        setShowChatOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showChatOptions]);

  // Load messages when conversation is selected
  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedConversation?.id || !user?.id) return;
      
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
          .eq('conversation_id', selectedConversation.id)
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        setMessages(messagesData || []);
        markAsRead(selectedConversation.id);
        
        setTimeout(() => {
          scrollToBottom();
        }, 50);
        
        setTimeout(() => {
          scrollToBottom();
        }, 200);
        
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    loadMessages();
  }, [selectedConversation?.id, user?.id, markAsRead]);

  // Load users and conversations
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        
        // Load users with online status and avatar_url
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, last_seen, phone, avatar_url')
          .neq('id', user.id)
          .order('full_name');

        if (usersError) {
          console.error('Error loading users:', usersError);
        } else {
          console.log('Loaded users:', usersData?.length || 0, usersData);
          const usersWithStatus = (usersData || []).map(user => ({
            ...user,
            is_online: user.last_seen ? 
              (Date.now() - new Date(user.last_seen).getTime()) < 5 * 60 * 1000 : false
          }));
          
          setUsers(usersWithStatus);
        }

        // Load conversations using enhanced API
        try {
          // Load active conversations
          const activeConversations = await EnhancedChatApi.getUserConversations(user.id, false);
          setConversations(activeConversations);

          // Load archived conversations
          const archivedConversations = await EnhancedChatApi.getUserConversations(user.id, true);
          setArchivedConversations(archivedConversations.filter(conv => conv.archived));

          // Load deleted conversations
          const deletedConversations = await EnhancedChatApi.getDeletedConversations(user.id);
          setDeletedConversations(deletedConversations);
        } catch (error) {
          console.error('Error loading conversations with enhanced API:', error);
          // Fallback to original method if enhanced API fails
          const { data: conversationsData, error: conversationsError } = await supabase
            .from('conversations')
            .select('*')
            .contains('participants', [user.id])
            .order('updated_at', { ascending: false });

          if (conversationsError) {
            console.error('Error loading conversations:', conversationsError);
          } else {
            setConversations(conversationsData || []);
          }
        }

      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user?.id) return;

    // Get all conversation IDs (both active and archived)
    const allConversationIds = [
      ...conversations.map(c => c.id),
      ...archivedConversations.map(c => c.id)
    ];

    // Subscribe to new messages
    const messagesChannel = supabase.channel('messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=in.(${allConversationIds.join(',')})`
      }, (payload) => {
        const newMessage = payload.new as Message;
        if (newMessage.sender_id !== user.id) {
          setMessages(prev => [...prev, newMessage]);
          setUnreadConversations(prev => new Set(prev).add(newMessage.conversation_id));
          
          // If this message is in an archived conversation, unarchive it
          const isArchived = archivedConversations.some(conv => conv.id === newMessage.conversation_id);
          if (isArchived) {
            handleUnarchiveChat(newMessage.conversation_id);
          }
        }
      });

    // Subscribe to conversation updates
    const conversationsChannel = supabase.channel('conversations')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `id=in.(${allConversationIds.join(',')})`
      }, () => {
        // Reload conversations when they change
        loadData();
      });

    messagesChannelRef.current = messagesChannel;
    conversationsChannelRef.current = conversationsChannel;

    return () => {
      messagesChannel.unsubscribe();
      conversationsChannel.unsubscribe();
    };
  }, [user?.id, conversations, archivedConversations]);

  const loadData = async () => {
    if (!user?.id) return;
    
    try {
      // Load active conversations
      const { data: conversationsData, error } = await supabase
        .from('conversations')
        .select('*')
        .contains('participants', [user.id])
        .order('updated_at', { ascending: false });

      if (!error) {
        setConversations(conversationsData || []);
      }

      // Load archived conversations (if archived column exists)
      const { data: archivedData, error: archivedError } = await supabase
        .from('conversations')
        .select('*')
        .contains('participants', [user.id])
        .eq('archived', true)
        .order('updated_at', { ascending: false });

      if (archivedError) {
        console.error('Error loading archived conversations:', archivedError);
        // If archived column doesn't exist yet, just set empty array
        setArchivedConversations([]);
      } else {
        setArchivedConversations(archivedData || []);
      }
    } catch (error) {
      console.error('Error reloading conversations:', error);
    }
  };

  const getConversationUser = (conversation: Conversation): User | null => {
    const otherParticipantId = conversation.participants.find(id => id !== user?.id);
    const foundUser = users.find(user => user.id === otherParticipantId);
    console.log('getConversationUser:', { 
      conversationId: conversation.id, 
      participants: conversation.participants, 
      currentUserId: user?.id, 
      otherParticipantId, 
      usersCount: users.length, 
      foundUser 
    });
    return foundUser || null;
  };

  const getConversationLastMessage = (conversation: Conversation) => {
    return 'No messages yet';
  };

  const handleStartNewChat = (selectedUser: User) => {
    setSelectedUserForChat(selectedUser);
    setShowNewChatModal(true);
  };

  const createNewConversation = async (selectedUser: User, subject: string) => {
    if (!user?.id) return;
    
    try {
      // Always create a new conversation, even if one exists with the same participants
      // This allows multiple chat instances with the same person
      const { data: newConversation, error } = await supabase
        .from('conversations')
        .insert({
          participants: [user.id, selectedUser.id],
          type: 'direct',
          subject: subject || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log('Created new conversation:', newConversation);
      setConversations(prev => [newConversation, ...prev]);
      setSelectedConversation(newConversation);
      setActiveTab('chats');
      setShowNewChatModal(false);
      setSelectedUserForChat(null);
      setNewChatSubject('');
      
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (newMessage.trim() && selectedConversation?.id && user?.id) {
      try {
        setSending(true);
        
        // Check if the conversation is archived and unarchive it if so
        const isArchived = archivedConversations.some(conv => conv.id === selectedConversation.id);
        if (isArchived) {
          await handleUnarchiveChat(selectedConversation.id);
        }
        
        const { data: newMessageData, error } = await supabase
          .from('messages')
          .insert({
            conversation_id: selectedConversation.id,
            sender_id: user.id,
            body: newMessage.trim(),
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) throw error;
        
        setMessages(prev => [...prev, {
          ...newMessageData,
          sender: {
            id: user.id,
            full_name: user.user_metadata?.full_name,
            email: user.email,
            avatar_url: user.user_metadata?.avatar_url
          }
        }]);
        
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', selectedConversation.id);
        
        setNewMessage('');
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      } catch (error) {
        console.error('Error sending message:', error);
      } finally {
        setSending(false);
      }
    }
  };



  const handleArchiveChat = async (conversationId: string) => {
    try {
      await EnhancedChatApi.archiveConversation(conversationId);
      
      // Reload conversations
      const activeConversations = await EnhancedChatApi.getUserConversations(user?.id!, false);
      const archivedConversations = await EnhancedChatApi.getUserConversations(user?.id!, true);
      setConversations(activeConversations);
      setArchivedConversations(archivedConversations.filter(conv => conv.archived));
      
      // If this was the selected conversation, clear it
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
      }
      
      setShowChatOptions(false);
    } catch (error) {
      console.error('Error archiving conversation:', error);
    }
  };

  const handleUnarchiveChat = async (conversationId: string) => {
    try {
      await EnhancedChatApi.unarchiveConversation(conversationId);
      
      // Reload conversations
      const activeConversations = await EnhancedChatApi.getUserConversations(user?.id!, false);
      const archivedConversations = await EnhancedChatApi.getUserConversations(user?.id!, true);
      setConversations(activeConversations);
      setArchivedConversations(archivedConversations.filter(conv => conv.archived));
    } catch (error) {
      console.error('Error unarchiving conversation:', error);
    }
  };

  const handleDeleteChat = async (conversationId: string) => {
    try {
      await EnhancedChatApi.deleteConversation(conversationId);
      
      // Reload conversations
      const activeConversations = await EnhancedChatApi.getUserConversations(user?.id!, false);
      const archivedConversations = await EnhancedChatApi.getUserConversations(user?.id!, true);
      const deletedConversations = await EnhancedChatApi.getDeletedConversations(user?.id!);
      setConversations(activeConversations);
      setArchivedConversations(archivedConversations.filter(conv => conv.archived));
      setDeletedConversations(deletedConversations);
      
      // If this was the selected conversation, clear it
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const handleRestoreChat = async (conversationId: string) => {
    try {
      await EnhancedChatApi.restoreConversation(conversationId);
      
      // Reload conversations
      const activeConversations = await EnhancedChatApi.getUserConversations(user?.id!, false);
      const deletedConversations = await EnhancedChatApi.getDeletedConversations(user?.id!);
      setConversations(activeConversations);
      setDeletedConversations(deletedConversations);
    } catch (error) {
      console.error('Error restoring conversation:', error);
    }
  };

  const handleDeleteAllPermanently = async () => {
    if (deletedConversations.length === 0) {
      alert('No deleted conversations to permanently delete');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete all ${deletedConversations.length} deleted conversations? This action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeletingAll(true);
    try {
      // Delete all conversations in parallel
      await Promise.all(
        deletedConversations.map(conv => 
          EnhancedChatApi.permanentlyDeleteConversation(conv.id)
        )
      );
      
      // Reload conversations
      const activeConversations = await EnhancedChatApi.getUserConversations(user?.id!, false);
      const updatedDeletedConversations = await EnhancedChatApi.getDeletedConversations(user?.id!);
      setConversations(activeConversations);
      setDeletedConversations(updatedDeletedConversations);
      
      alert('All deleted conversations have been permanently removed');
    } catch (error) {
      console.error('Error permanently deleting conversations:', error);
      alert('Failed to permanently delete some conversations');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleEditSubject = () => {
    if (selectedConversation) {
      setEditSubjectValue(selectedConversation.subject || '');
      setEditingSubject(true);
    }
  };

  const handleSaveSubject = async () => {
    if (!selectedConversation?.id) return;
    
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ 
          subject: editSubjectValue.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedConversation.id);
      
      if (error) throw error;
      
      // Update local state
      setSelectedConversation(prev => prev ? { ...prev, subject: editSubjectValue.trim() || null } : null);
      setConversations(prev => prev.map(conv => 
        conv.id === selectedConversation.id 
          ? { ...conv, subject: editSubjectValue.trim() || null }
          : conv
      ));
      
      setEditingSubject(false);
      setEditSubjectValue('');
    } catch (error) {
      console.error('Error updating subject:', error);
    }
  };

  const handleCancelEditSubject = () => {
    setEditingSubject(false);
    setEditSubjectValue('');
  };

  // Check if current conversation is floating in tray
  const isCurrentChatFloating = selectedConversation && openChats.some(chat => chat.id === selectedConversation.id);

  // Wait for authentication to complete
  if (initializing) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Check if user is authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">Please log in to access messaging</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Mobile Header - Only visible on mobile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                if (selectedConversation) {
                  setSelectedConversation(null);
                } else {
                  // Navigate back to dashboard
                  window.history.back();
                }
              }}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedConversation ? 'Chat' : 'Messages'}
            </h1>
          </div>
          
          {!selectedConversation && (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setActiveTab('chats')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  activeTab === 'chats'
                    ? 'bg-blue-100 dark:bg-blue-900/20'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="Active Chats"
              >
                <MessageCircle className={`h-5 w-5 ${
                  activeTab === 'chats' ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'
                }`} />
              </button>
              <button
                onClick={() => setActiveTab('archived')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  activeTab === 'archived'
                    ? 'bg-orange-100 dark:bg-orange-900/20'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="Archived Chats"
              >
                <Archive className={`h-5 w-5 ${
                  activeTab === 'archived' ? 'text-orange-600' : 'text-gray-500 dark:text-gray-400'
                }`} />
              </button>
              <button
                onClick={() => setActiveTab('deleted')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  activeTab === 'deleted'
                    ? 'bg-red-100 dark:bg-red-900/20'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="Deleted Chats"
              >
                <Trash2 className={`h-5 w-5 ${
                  activeTab === 'deleted' ? 'text-red-600' : 'text-gray-500 dark:text-gray-400'
                }`} />
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  activeTab === 'users'
                    ? 'bg-green-100 dark:bg-green-900/20'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                title="Users"
              >
                <Users className={`h-5 w-5 ${
                  activeTab === 'users' ? 'text-green-600' : 'text-gray-500 dark:text-gray-400'
                }`} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar - Hidden on mobile, shown on desktop */}
      <div className="hidden lg:flex w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex-col">
        {/* Header - Sticky */}
        <div className="sticky top-0 z-20 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Messages</h1>
          </div>
        </div>

        {/* Tabs - Sticky */}
        <div className="sticky top-16 z-10 flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={() => setActiveTab('chats')}
            className={`flex-1 py-4 px-4 flex items-center justify-center transition-all duration-200 ${
              activeTab === 'chats'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-b-2 border-blue-600'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title="Active Chats"
          >
            <MessageCircle className={`h-5 w-5 ${
              activeTab === 'chats' ? 'text-blue-600' : 'text-gray-500 dark:text-gray-400'
            }`} />
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`flex-1 py-4 px-4 flex items-center justify-center transition-all duration-200 ${
              activeTab === 'archived'
                ? 'bg-orange-50 dark:bg-orange-900/20 border-b-2 border-orange-600'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title="Archived Chats"
          >
            <Archive className={`h-5 w-5 ${
              activeTab === 'archived' ? 'text-orange-600' : 'text-gray-500 dark:text-gray-400'
            }`} />
          </button>
          <button
            onClick={() => setActiveTab('deleted')}
            className={`flex-1 py-4 px-4 flex items-center justify-center transition-all duration-200 ${
              activeTab === 'deleted'
                ? 'bg-red-50 dark:bg-red-900/20 border-b-2 border-red-600'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title="Deleted Chats"
          >
            <Trash2 className={`h-5 w-5 ${
              activeTab === 'deleted' ? 'text-red-600' : 'text-gray-500 dark:text-gray-400'
            }`} />
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-4 px-4 flex items-center justify-center transition-all duration-200 ${
              activeTab === 'users'
                ? 'bg-green-50 dark:bg-green-900/20 border-b-2 border-green-600'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title="Users"
          >
            <Users className={`h-5 w-5 ${
              activeTab === 'users' ? 'text-green-600' : 'text-gray-500 dark:text-gray-400'
            }`} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col relative">
          {activeTab === 'chats' ? (
            <div className="p-2">
              {conversations.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No conversations yet</p>
                  <p className="text-sm">Start a new chat to get started</p>
                </div>
              ) : (
                conversations.map(conversation => {
                  const conversationUser = getConversationUser(conversation);
                  const lastMessage = getConversationLastMessage(conversation);
                  const isSelected = selectedConversation?.id === conversation.id;
                  
                  return (
                    <div
                      key={conversation.id}
                      onClick={() => setSelectedConversation(conversation)}
                      className={`group flex items-start space-x-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                        isSelected 
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' 
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                      }`}
                    >
                      {/* Avatar with status dot */}
                      <div className="relative flex-shrink-0">
                        {conversationUser?.avatar_url ? (
                          <img
                            src={getAvatarUrl(conversationUser.avatar_url)}
                            alt={conversationUser.full_name || 'User'}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            {(conversationUser?.full_name || conversationUser?.email || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        {/* Small status dot */}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-gray-900 ${
                          conversationUser?.is_online ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                      </div>

                      {/* Conversation details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="min-w-0">
                            {/* User name line (TOP) */}
                            <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                              {conversationUser?.full_name || conversationUser?.email}
                            </div>
                            {/* Subject line (BOTTOM) */}
                            <div className="font-medium text-xs text-gray-500 dark:text-gray-400 truncate">
                              {conversation.subject || 'No subject'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1">
                          {lastMessage}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="opacity-0 group-hover:opacity-100 flex space-x-1 transition-all duration-200">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveChat(conversation.id);
                          }}
                          className="p-2 text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                          title="Archive conversation"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChat(conversation.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete conversation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : activeTab === 'archived' ? (
            <div className="p-2">
              {archivedConversations.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Archive className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No archived conversations</p>
                </div>
              ) : (
                archivedConversations.map(conversation => {
                  const conversationUser = getConversationUser(conversation);
                  const isSelected = selectedConversation?.id === conversation.id;
                  
                  return (
                    <div
                      key={conversation.id}
                      onClick={() => setSelectedConversation(conversation)}
                      className={`group flex items-start space-x-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                        isSelected 
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' 
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                      }`}
                    >
                      {/* Avatar with status dot */}
                      <div className="relative flex-shrink-0">
                        {conversationUser?.avatar_url ? (
                          <img
                            src={getAvatarUrl(conversationUser.avatar_url)}
                            alt={conversationUser.full_name || 'User'}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            {(conversationUser?.full_name || conversationUser?.email || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        {/* Small status dot */}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-gray-900 ${
                          conversationUser?.is_online ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                      </div>

                      {/* Conversation details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                              {conversationUser?.full_name || conversationUser?.email}
                            </div>
                            <div className="font-medium text-xs text-gray-500 dark:text-gray-400 truncate">
                              {conversation.subject || 'No subject'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="opacity-0 group-hover:opacity-100 flex space-x-1 transition-all duration-200">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnarchiveChat(conversation.id);
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Unarchive conversation"
                        >
                          <ArchiveRestore className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChat(conversation.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete conversation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : activeTab === 'deleted' ? (
            <div className="p-2">
              {deletedConversations.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Trash2 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No deleted conversations</p>
                </div>
              ) : (
                deletedConversations.map(conversation => {
                  const conversationUser = getConversationUser(conversation);
                  const isSelected = selectedConversation?.id === conversation.id;
                  
                  return (
                    <div
                      key={conversation.id}
                      onClick={() => setSelectedConversation(conversation)}
                      className={`group flex items-start space-x-3 p-3 rounded-xl cursor-pointer transition-all duration-200 opacity-60 ${
                        isSelected 
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' 
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                      }`}
                    >
                      {/* Avatar with deleted indicator */}
                      <div className="relative flex-shrink-0">
                        {conversationUser?.avatar_url ? (
                          <img
                            src={getAvatarUrl(conversationUser.avatar_url)}
                            alt={conversationUser.full_name || 'User'}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            {(conversationUser?.full_name || conversationUser?.email || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <Clock className="absolute -bottom-1 -right-1 w-3 h-3 text-gray-400" />
                      </div>

                      {/* Conversation details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="min-w-0">
                            <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                              {conversationUser?.full_name || conversationUser?.email}
                            </div>
                            <div className="font-medium text-xs text-gray-500 dark:text-gray-400 truncate">
                              {conversation.subject || 'No subject'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="opacity-0 group-hover:opacity-100 flex space-x-1 transition-all duration-200">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestoreChat(conversation.id);
                          }}
                          className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                          title="Restore conversation"
                        >
                          <ArchiveRestore className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteChat(conversation.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete forever"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
              
              {/* Delete All Forever Button */}
              {deletedConversations.length > 0 && (
                <div className="mt-4 p-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleDeleteAllPermanently}
                    disabled={isDeletingAll}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition-colors duration-200"
                  >
                    {isDeletingAll ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Delete All Forever ({deletedConversations.length})</span>
                      </>
                    )}
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                    This action cannot be undone
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-2">
              {users.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No users found</p>
                </div>
              ) : (
                users.map(user => (
                  <div
                    key={user.id}
                    onClick={() => handleStartNewChat(user)}
                    className="group flex items-start space-x-3 p-3 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200"
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {user.avatar_url ? (
                        <img
                          src={getAvatarUrl(user.avatar_url)}
                          alt={user.full_name || 'User'}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                          {(user.full_name || user.email).charAt(0).toUpperCase()}
                        </div>
                      )}
                      {/* Small status dot */}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-gray-900 ${
                        user.is_online ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                    </div>

                    {/* User details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="min-w-0">
                          {/* User name line (TOP) */}
                          <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {user.full_name || user.email}
                          </div>
                          {/* Role line (BOTTOM) */}
                          <div className="font-medium text-xs text-gray-500 dark:text-gray-400 truncate">
                            {user.role}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1">
                        {user.is_online ? 'Online' : 'Offline'}
                      </div>
                    </div>

                    {/* Start chat button */}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartNewChat(user);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all duration-200"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Content Area - Only visible on mobile when no conversation is selected */}
      {!selectedConversation && (
        <div className="lg:hidden flex-1 flex flex-col pt-16">
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'chats' ? (
              <div className="p-4">
                {conversations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>No conversations yet</p>
                    <p className="text-sm">Start a new chat to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {conversations.map(conversation => {
                      const conversationUser = getConversationUser(conversation);
                      const lastMessage = getConversationLastMessage(conversation);
                      
                      return (
                        <div
                          key={conversation.id}
                          onClick={() => setSelectedConversation(conversation)}
                          className="flex items-start space-x-3 p-3 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200"
                        >
                          {/* Avatar with status dot */}
                          <div className="relative flex-shrink-0">
                            {conversationUser?.avatar_url ? (
                              <img
                                src={getAvatarUrl(conversationUser.avatar_url)}
                                alt={conversationUser.full_name || 'User'}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                                {(conversationUser?.full_name || conversationUser?.email || 'U').charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-gray-900 ${
                              conversationUser?.is_online ? 'bg-green-500' : 'bg-red-500'
                            }`}></div>
                          </div>

                          {/* Conversation details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <div className="min-w-0">
                                <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                                  {conversationUser?.full_name || conversationUser?.email}
                                </div>
                                <div className="font-medium text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {conversation.subject || 'No subject'}
                                </div>
                              </div>
                            </div>
                            
                            <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1">
                              {lastMessage}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4">
                {users.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Users className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                    <p>No users found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {users.map(user => (
                      <div
                        key={user.id}
                        onClick={() => handleStartNewChat(user)}
                        className="flex items-start space-x-3 p-3 rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all duration-200"
                      >
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          {user.avatar_url ? (
                            <img
                              src={getAvatarUrl(user.avatar_url)}
                              alt={user.full_name || 'User'}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              {(user.full_name || user.email).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white dark:border-gray-900 ${
                            user.is_online ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                        </div>

                        {/* User details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <div className="min-w-0">
                              <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                                {user.full_name || user.email}
                              </div>
                              <div className="font-medium text-xs text-gray-500 dark:text-gray-400 truncate">
                                {user.role}
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-1">
                            {user.is_online ? 'Online' : 'Offline'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className={`flex-1 flex flex-col ${selectedConversation ? 'lg:flex' : 'hidden lg:flex'}`}>
        {selectedConversation ? (
          <div key={selectedConversation.id} className={`flex-1 flex flex-col h-full transition-all duration-300 ease-in-out ${isCurrentChatFloating ? 'opacity-50' : 'opacity-100'}`}>
            {/* Chat Header - Sticky */}
            <div className="sticky top-0 z-20 p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-3">
                    {(() => {
                      const conversationUser = getConversationUser(selectedConversation);
                      return (
                        <>
                          {conversationUser?.avatar_url ? (
                            <img
                              src={getAvatarUrl(conversationUser.avatar_url)}
                              alt={conversationUser.full_name || 'User'}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                              {(conversationUser?.full_name || conversationUser?.email || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {conversationUser?.full_name || conversationUser?.email}
                            </h3>
                            {editingSubject ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={editSubjectValue}
                                  onChange={(e) => setEditSubjectValue(e.target.value)}
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSaveSubject();
                                    } else if (e.key === 'Escape') {
                                      handleCancelEditSubject();
                                    }
                                  }}
                                  className="text-sm text-gray-500 dark:text-gray-400 bg-transparent border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:outline-none"
                                  placeholder="Enter subject..."
                                  autoFocus
                                />
                                <button
                                  onClick={handleSaveSubject}
                                  className="text-green-600 hover:text-green-700 text-xs"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={handleCancelEditSubject}
                                  className="text-red-600 hover:text-red-700 text-xs"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <p 
                                className="text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300"
                                onClick={handleEditSubject}
                                title="Click to edit subject"
                              >
                                {selectedConversation?.subject || 'No subject - click to add'}
                              </p>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Popout/Float button */}
                  <button
                    onClick={() => {
                      if (selectedConversation) {
                        if (isCurrentChatFloating) {
                          // If already floating, bring it back to main view
                          // This would require a function to close the floating chat
                          // For now, we'll just open it again which will toggle the state
                          openChat(selectedConversation.id);
                        } else {
                          // Pop out to floating window
                          openChat(selectedConversation.id);
                        }
                      }
                    }}
                    className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      isCurrentChatFloating 
                        ? 'text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300' 
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                    title={isCurrentChatFloating ? "Chat is already floating" : "Pop out to floating window"}
                  >
                    <Expand className="h-5 w-5" />
                  </button>
                  

                  
                  {/* Phone button - connected to user's phone number */}
                  {(() => {
                    const conversationUser = getConversationUser(selectedConversation);
                    return conversationUser?.phone ? (
                      <a
                        href={`tel:${conversationUser.phone}`}
                        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Phone className="h-5 w-5" />
                      </a>
                    ) : null;
                  })()}
                  
                  {/* Three dots menu */}
                  <div className="relative">
                    <button 
                      data-dropdown
                      onClick={() => setShowChatOptions(!showChatOptions)}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                    
                    {/* Chat Options Dropdown */}
                    {showChatOptions && (
                      <div data-dropdown className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                        <div className="py-1">
                          <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            Chat Options
                          </div>
                          <button
                            onClick={() => {
                              if (selectedConversation) {
                                const conversationUser = getConversationUser(selectedConversation);
                                if (conversationUser) {
                                  setSelectedUserForChat(conversationUser);
                                  setShowNewChatModal(true);
                                  setShowChatOptions(false);
                                }
                              }
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            Start New Chat
                          </button>
                          <button
                            onClick={() => {
                              if (selectedConversation) {
                                handleArchiveChat(selectedConversation.id);
                              }
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          >
                            Archive Chat
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Messages - Scrollable Container (iPhone-style: newest at bottom) */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto min-h-0 scroll-smooth">
              <div key={selectedConversation?.id || 'no-conversation'} className="flex flex-col justify-end min-h-full p-4 space-y-4 transition-all duration-300 ease-in-out">
                {messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <div className="text-center">
                      <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                      <p>No messages yet</p>
                      <p className="text-sm">Start the conversation!</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Messages list - oldest first, newest at bottom (iPhone-style) */}
                    {messages.map(message => {
                      const isOwnMessage = message.sender_id === user?.id;
                      
                      return (
                        <div key={message.id} className={`flex items-start space-x-3 ${isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''} transition-all duration-200 ease-in-out`}>
                          {/* Avatar - Left for received, Right for sent */}
                          <div className="flex-shrink-0">
                            {message.sender?.avatar_url ? (
                              <img
                                src={getAvatarUrl(message.sender.avatar_url)}
                                alt={message.sender.full_name || 'User'}
                                className="w-8 h-8 rounded-full object-cover transition-opacity duration-200 ease-in-out"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 transition-opacity duration-200 ease-in-out">
                                {(message.sender?.full_name || message.sender?.email || 'U').charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          
                          {/* Message Bubble */}
                          <div className={`min-w-[200px] max-w-xs lg:max-w-md ${isOwnMessage ? 'text-right' : 'text-left'}`}>
                            <div className={`rounded-lg px-4 py-2 shadow-sm transition-all duration-200 ease-in-out ${
                              isOwnMessage 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
                            }`}>
                              <p className="text-sm break-words">{message.body}</p>
                              <p className={`text-xs mt-1 ${
                                isOwnMessage 
                                  ? 'text-blue-100' 
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}>
                                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {/* Bottom padding to prevent message input overlap */}
                    <div className="pb-16"></div>
                    {/* Scroll anchor for new messages */}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            </div>

            {/* Message Input - Sticky Bottom */}
            <div className="sticky bottom-0 z-10 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (newMessage.trim() && selectedConversation?.id && user?.id) {
                        const target = e.target as HTMLInputElement;
                        const sendButton = target.nextElementSibling as HTMLButtonElement;
                        if (sendButton) {
                          sendButton.click();
                        }
                      }
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !newMessage.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center transition-all duration-300 ease-in-out">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">No conversation selected</h3>
              <p className="text-sm">Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && selectedUserForChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Start New Chat with {selectedUserForChat.full_name || selectedUserForChat.email}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Subject (optional)
              </label>
              <input
                type="text"
                value={newChatSubject}
                onChange={(e) => setNewChatSubject(e.target.value)}
                placeholder="Enter chat subject..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowNewChatModal(false);
                  setSelectedUserForChat(null);
                  setNewChatSubject('');
                }}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedUserForChat) {
                    createNewConversation(selectedUserForChat, newChatSubject);
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Start Chat
              </button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
}

export default MessagingPage;

