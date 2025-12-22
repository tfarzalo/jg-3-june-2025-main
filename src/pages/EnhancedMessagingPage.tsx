import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthProvider';
import { useUnreadMessages } from '../contexts/UnreadMessagesProvider';
import { useChatTray } from '../contexts/ChatTrayProvider';
import { useUserRole } from '../contexts/UserRoleContext';
import { 
  MessageCircle, 
  Settings, 
  Users, 
  Plus, 
  Search, 
  Send, 
  MoreVertical, 
  Phone, 
  Expand, 
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Trash2,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { supabase, getAvatarUrl } from '../utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ChatDock } from '../components/chat/ChatDock';
import { EnhancedConversationItem } from '../components/chat/EnhancedConversationItem';
import { EnhancedChatApi, Conversation, DeletedConversation } from '../services/enhancedChatApi';

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

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: User;
}

function EnhancedMessagingPage() {
  const { user, initializing } = useAuth();
  const { markAsRead } = useUnreadMessages();
  const { openChat, openChats } = useChatTray();
  const { isSubcontractor } = useUserRole();
  
  // State management
  const [users, setUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [deletedConversations, setDeletedConversations] = useState<DeletedConversation[]>([]);
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
  const [editingSubject, setEditingSubject] = useState(false);
  const [editSubjectValue, setEditSubjectValue] = useState('');
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<Set<string>>(new Set());
  
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          scrollToBottom();
        }, 50);
      });
    }
  }, [messages]);

  // Load data when component mounts
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        
        // Load users
        const { data: usersData, error: usersError } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, last_seen, phone, avatar_url')
          .neq('id', user.id)
          .order('full_name');

        if (usersError) {
          console.error('Error loading users:', usersError);
        } else {
          const usersWithStatus = (usersData || []).map(user => ({
            ...user,
            is_online: user.last_seen ? 
              (Date.now() - new Date(user.last_seen).getTime()) < 5 * 60 * 1000 : false
          }));
          setUsers(usersWithStatus);
        }

        // Load conversations using enhanced API
        await loadConversations();
        
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id]);

  // Load conversations using enhanced API
  const loadConversations = async () => {
    if (!user?.id) return;

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
      console.error('Error loading conversations:', error);
    }
  };

  // Get conversation user (other participant)
  const getConversationUser = (conversation: Conversation): User | null => {
    if (!user?.id) return null;
    
    const otherParticipantId = conversation.participants.find(id => id !== user.id);
    if (!otherParticipantId) return null;
    
    return users.find(u => u.id === otherParticipantId) || null;
  };

  // Get last message for conversation
  const getConversationLastMessage = (conversation: Conversation): string => {
    // This would need to be implemented with actual message fetching
    return 'Last message preview...';
  };

  // Handle conversation selection
  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowBulkActions(false);
    setSelectedConversations(new Set());
  };

  // Handle archiving conversation
  const handleArchiveConversation = async (conversationId: string) => {
    try {
      await EnhancedChatApi.archiveConversation(conversationId);
      await loadConversations();
      
      // If this was the selected conversation, clear it
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
      }
    } catch (error) {
      console.error('Error archiving conversation:', error);
    }
  };

  // Handle unarchiving conversation
  const handleUnarchiveConversation = async (conversationId: string) => {
    try {
      await EnhancedChatApi.unarchiveConversation(conversationId);
      await loadConversations();
    } catch (error) {
      console.error('Error unarchiving conversation:', error);
    }
  };

  // Handle deleting conversation
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await EnhancedChatApi.deleteConversation(conversationId);
      await loadConversations();
      
      // If this was the selected conversation, clear it
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  // Handle restoring conversation
  const handleRestoreConversation = async (conversationId: string) => {
    try {
      await EnhancedChatApi.restoreConversation(conversationId);
      await loadConversations();
    } catch (error) {
      console.error('Error restoring conversation:', error);
    }
  };

  // Handle bulk actions
  const handleBulkArchive = async () => {
    try {
      await EnhancedChatApi.bulkArchiveConversations(Array.from(selectedConversations));
      await loadConversations();
      setSelectedConversations(new Set());
      setShowBulkActions(false);
    } catch (error) {
      console.error('Error bulk archiving conversations:', error);
    }
  };

  const handleBulkDelete = async () => {
    try {
      await EnhancedChatApi.bulkDeleteConversations(Array.from(selectedConversations));
      await loadConversations();
      setSelectedConversations(new Set());
      setShowBulkActions(false);
    } catch (error) {
      console.error('Error bulk deleting conversations:', error);
    }
  };

  // Toggle conversation selection for bulk actions
  const toggleConversationSelection = (conversationId: string) => {
    const newSelected = new Set(selectedConversations);
    if (newSelected.has(conversationId)) {
      newSelected.delete(conversationId);
    } else {
      newSelected.add(conversationId);
    }
    setSelectedConversations(newSelected);
  };

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv => {
    if (!searchQuery) return true;
    const conversationUser = getConversationUser(conv);
    const userName = conversationUser?.full_name || conversationUser?.email || '';
    const subject = conv.subject || '';
    return userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           subject.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredArchivedConversations = archivedConversations.filter(conv => {
    if (!searchQuery) return true;
    const conversationUser = getConversationUser(conv);
    const userName = conversationUser?.full_name || conversationUser?.email || '';
    const subject = conv.subject || '';
    return userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           subject.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredDeletedConversations = deletedConversations.filter(conv => {
    if (!searchQuery) return true;
    const conversationUser = getConversationUser(conv);
    const userName = conversationUser?.full_name || conversationUser?.email || '';
    const subject = conv.subject || '';
    return userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
           subject.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (initializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Please log in to access messaging
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Messages
            </h1>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('chats')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'chats'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Chats ({conversations.length})
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'archived'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Archived ({archivedConversations.length})
            </button>
            <button
              onClick={() => setActiveTab('deleted')}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'deleted'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Deleted ({deletedConversations.length})
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {showBulkActions && selectedConversations.size > 0 && (
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedConversations.size} selected
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={handleBulkArchive}
                  className="px-3 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600"
                >
                  Archive
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-3 p-4">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-2">
              {activeTab === 'chats' && (
                <>
                  {filteredConversations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                      <p>No conversations yet</p>
                      <p className="text-sm">Start a new chat to get started</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredConversations.map(conversation => (
                        <EnhancedConversationItem
                          key={conversation.id}
                          conversation={conversation}
                          conversationUser={getConversationUser(conversation)}
                          currentUserId={user.id}
                          isSelected={selectedConversation?.id === conversation.id}
                          onSelect={handleSelectConversation}
                          onArchive={handleArchiveConversation}
                          onUnarchive={handleUnarchiveConversation}
                          onDelete={handleDeleteConversation}
                          lastMessage={getConversationLastMessage(conversation)}
                          unreadCount={0} // This would need to be calculated
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'archived' && (
                <>
                  {filteredArchivedConversations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Archive className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                      <p>No archived conversations</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredArchivedConversations.map(conversation => (
                        <EnhancedConversationItem
                          key={conversation.id}
                          conversation={conversation}
                          conversationUser={getConversationUser(conversation)}
                          currentUserId={user.id}
                          isSelected={selectedConversation?.id === conversation.id}
                          onSelect={handleSelectConversation}
                          onArchive={handleArchiveConversation}
                          onUnarchive={handleUnarchiveConversation}
                          onDelete={handleDeleteConversation}
                          lastMessage={getConversationLastMessage(conversation)}
                          unreadCount={0}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'deleted' && (
                <>
                  {filteredDeletedConversations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <Trash2 className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                      <p>No deleted conversations</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredDeletedConversations.map(conversation => (
                        <EnhancedConversationItem
                          key={conversation.id}
                          conversation={conversation}
                          conversationUser={getConversationUser(conversation)}
                          currentUserId={user.id}
                          isSelected={selectedConversation?.id === conversation.id}
                          onSelect={handleSelectConversation}
                          onArchive={handleArchiveConversation}
                          onUnarchive={handleUnarchiveConversation}
                          onDelete={handleDeleteConversation}
                          onRestore={handleRestoreConversation}
                          isDeleted={true}
                          lastMessage={getConversationLastMessage(conversation)}
                          unreadCount={0}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Bulk Actions Toggle */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setShowBulkActions(!showBulkActions)}
            className="w-full px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {showBulkActions ? 'Cancel Selection' : 'Select Multiple'}
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <div className="flex-1 flex flex-col">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setSelectedConversation(null)}
                    className="lg:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center space-x-3">
                    {(() => {
                      const conversationUser = getConversationUser(selectedConversation);
                      return (
                        <>
                          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            {conversationUser?.avatar_url ? (
                              <img
                                src={getAvatarUrl(conversationUser.avatar_url)}
                                alt={conversationUser.full_name || 'User'}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-lg font-semibold text-gray-600 dark:text-gray-300">
                                {(conversationUser?.full_name || conversationUser?.email || 'U').charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {conversationUser?.full_name || conversationUser?.email}
                            </h3>
                            {selectedConversation.subject && (
                              <p className="text-sm text-blue-600 dark:text-blue-400">
                                {selectedConversation.subject}
                              </p>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    <Phone className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {messages.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                  <p>No messages yet</p>
                  <p className="text-sm">Start the conversation!</p>
                </div>
              ) : (
                messages.map(message => {
                  const isOwnMessage = message.sender_id === user.id;
                  return (
                    <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                        isOwnMessage 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                      }`}>
                        <p className="text-sm">{message.body}</p>
                        <p className={`text-xs mt-1 ${
                          isOwnMessage 
                            ? 'text-blue-100' 
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
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
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <div className="flex items-center space-x-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      // Handle send message
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  disabled={!newMessage.trim()}
                  className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium mb-2">No conversation selected</h3>
              <p className="text-sm">Choose a conversation from the sidebar to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Start New Chat
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select User
              </label>
              <select
                value={selectedUserForChat?.id || ''}
                onChange={(e) => {
                  const user = users.find(u => u.id === e.target.value);
                  setSelectedUserForChat(user || null);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Choose a user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.email} ({user.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Subject (Optional)
              </label>
              <input
                type="text"
                value={newChatSubject}
                onChange={(e) => setNewChatSubject(e.target.value)}
                placeholder="Enter chat subject..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                  // Handle start chat
                  setShowNewChatModal(false);
                  setSelectedUserForChat(null);
                  setNewChatSubject('');
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

export default EnhancedMessagingPage;
