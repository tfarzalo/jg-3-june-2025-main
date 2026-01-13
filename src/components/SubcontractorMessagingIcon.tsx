import React, { useState, useEffect } from 'react';
import { MessageCircle, X, Users, Plus, Archive, ArchiveRestore, Trash2, Search, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthProvider';
import { useChatTray } from '../contexts/ChatTrayProvider';
import { useUnreadMessages } from '../contexts/UnreadMessagesProvider';
import { supabase } from '../utils/supabase';
import { startDM } from '../services/chatApi';
import { getAvatarProps } from '../utils/avatarUtils';
import { EnhancedChatApi, Conversation as EnhancedConversation, DeletedConversation } from '../services/enhancedChatApi';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url?: string | null;
  last_seen?: string;
  is_online?: boolean;
}

interface Conversation {
  id: string;
  participants: string[];
  updated_at: string;
  subject?: string;
  archived?: boolean;
  last_message?: string;
  unread_count?: number;
  deleted_at?: string;
  deleted_by?: string;
}

export function SubcontractorMessagingIcon() {
  const { user } = useAuth();
  const { openChats, openChat } = useChatTray();
  const { unreadCount } = useUnreadMessages();
  const [isOpen, setIsOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [deletedConversations, setDeletedConversations] = useState<DeletedConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [showNewChatForm, setShowNewChatForm] = useState(false);
  const [selectedUserForChat, setSelectedUserForChat] = useState<User | null>(null);
  const [chatSubject, setChatSubject] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'archived' | 'deleted'>('active');

  const currentUserId = user?.id;

  // Check if user is online (within last 5 minutes)
  const isUserOnline = (lastSeen: string | null): boolean => {
    if (!lastSeen) return false;
    const lastSeenTime = new Date(lastSeen).getTime();
    const now = new Date().getTime();
    const fiveMinutes = 5 * 60 * 1000;
    return (now - lastSeenTime) < fiveMinutes;
  };

  // Avatar display component
  const AvatarDisplay = ({ user, size = 'w-10 h-10' }: { user: User | null; size?: string }) => {
    if (!user) {
      return (
        <div className={`${size} bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden`}>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">U</span>
        </div>
      );
    }

    const avatarProps = getAvatarProps(user);
    
    return (
      <div className={`${size} bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden`}>
        {avatarProps.avatarUrl ? (
          <img
            src={avatarProps.avatarUrl}
            alt={getUserDisplayName(user)}
            className={`${size} rounded-full object-cover`}
            onError={(e) => {
              // Fallback to initials if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML = `<span class="text-sm font-medium text-gray-600 dark:text-gray-300">${avatarProps.initials}</span>`;
              }
            }}
          />
        ) : (
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {avatarProps.initials}
          </span>
        )}
      </div>
    );
  };

  // Load available users (admin and jg_management only)
  const loadAvailableUsers = async () => {
    if (!currentUserId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, avatar_url, last_seen')
        .neq('id', currentUserId)
        .in('role', ['admin', 'jg_management'])
        .order('full_name');

      if (error) {
        console.error('Error loading available users:', error);
        return;
      }

      const usersWithStatus = (data || []).map(user => ({
        ...user,
        is_online: isUserOnline(user.last_seen)
      }));

      setAvailableUsers(usersWithStatus);
    } catch (error) {
      console.error('Error loading available users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load existing conversations using enhanced API
  const loadConversations = async () => {
    if (!currentUserId) return;

    try {
      // Load active conversations
      const activeConversations = await EnhancedChatApi.getUserConversations(currentUserId, false);
      
      // Load archived conversations
      const archivedConversations = await EnhancedChatApi.getUserConversations(currentUserId, true);
      
      // Load deleted conversations
      const deletedConversations = await EnhancedChatApi.getDeletedConversations(currentUserId);

      // Filter conversations to only include those with admin/jg_management users
      const filterConversations = async (conversations: any[]) => {
        const filtered = [];
        
        for (const conv of conversations || []) {
          const otherParticipantId = conv.participants.find(id => id !== currentUserId);
          if (otherParticipantId) {
            const { data: participantData, error: participantError } = await supabase
              .from('profiles')
              .select('role, avatar_url, full_name')
              .eq('id', otherParticipantId)
              .single();
            
            if (participantError) {
              console.error('Error fetching participant data:', participantError);
              continue;
            }
            
            if (participantData && ['admin', 'jg_management'].includes(participantData.role)) {
              filtered.push(conv);
            }
          }
        }
        
        return filtered;
      };

      setConversations(await filterConversations(activeConversations));
      setArchivedConversations(await filterConversations(archivedConversations.filter(conv => conv.archived)));
      setDeletedConversations(await filterConversations(deletedConversations));
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  // Load data when component mounts or when modal opens
  useEffect(() => {
    if (isOpen && currentUserId) {
      loadAvailableUsers();
      loadConversations();
    }
  }, [isOpen, currentUserId]);

  // Get user display name
  const getUserDisplayName = (user: User) => {
    return user.full_name || user.email;
  };

  // Get user role label
  const getUserRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'jg_management':
        return 'JG Management';
      default:
        return role;
    }
  };

  // Handle starting a new chat
  const handleStartChat = async (userId: string, subject?: string) => {
    try {
      // Check if conversation already exists
      const existingConv = conversations.find(conv => 
        conv.participants.includes(userId) && conv.participants.includes(currentUserId!)
      );

      if (existingConv) {
        openChat(existingConv.id);
      } else {
        // Use the startDM function to create new conversation
        const conversationId = await startDM(userId, subject);
        openChat(conversationId);
      }
      
      setIsOpen(false);
      setShowNewChatForm(false);
      setSelectedUserForChat(null);
      setChatSubject('');
    } catch (error: any) {
      console.error('Error starting chat:', error);
      // Handle subcontractor restriction error
      if (error.message.includes('Subcontractors cannot chat with other subcontractors')) {
        alert('Subcontractors can only chat with Admin and JG Management users');
      } else {
        alert('Failed to start chat');
      }
    }
  };

  // Handle archiving a conversation
  const handleArchiveConversation = async (conversationId: string) => {
    try {
      await EnhancedChatApi.archiveConversation(conversationId);
      loadConversations();
    } catch (error) {
      console.error('Error archiving conversation:', error);
      alert('Failed to archive conversation');
    }
  };

  // Handle unarchiving a conversation
  const handleUnarchiveConversation = async (conversationId: string) => {
    try {
      await EnhancedChatApi.unarchiveConversation(conversationId);
      loadConversations();
    } catch (error) {
      console.error('Error unarchiving conversation:', error);
      alert('Failed to unarchive conversation');
    }
  };

  // Handle deleting a conversation
  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await EnhancedChatApi.deleteConversation(conversationId);
      loadConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Failed to delete conversation');
    }
  };

  // Handle restoring a conversation
  const handleRestoreConversation = async (conversationId: string) => {
    try {
      await EnhancedChatApi.restoreConversation(conversationId);
      loadConversations();
    } catch (error) {
      console.error('Error restoring conversation:', error);
      alert('Failed to restore conversation');
    }
  };

  // Handle opening a conversation
  const handleOpenConversation = (conversationId: string) => {
    openChat(conversationId);
    setIsOpen(false);
  };

  // Early return if no user
  if (!user || !currentUserId) {
    return null;
  }

  return (
    <>
      {/* Top Bar Messaging Icon */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-[#1E293B] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#2D3B4E] transition-colors"
          title="Open messaging"
        >
          <MessageCircle className="h-5 w-5" />
          {/* Unread indicator from UnreadMessagesProvider */}
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
        </button>
      </div>

      {/* Messaging Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setIsOpen(false)}
            />

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full">
              {/* Header */}
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 flex items-center justify-between">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  Messages
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="px-4 py-5 sm:p-6">
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                {/* Tabs */}
                <div className="flex space-x-1 mb-4">
                  <button
                    onClick={() => setActiveTab('active')}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === 'active'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Active ({conversations.length})
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

                {/* New Chat Button */}
                <button
                  onClick={() => setShowNewChatForm(true)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors mb-4"
                >
                  <Plus className="w-4 h-4" />
                  <span>Start New Chat</span>
                </button>

                {/* New Chat Form */}
                {showNewChatForm && (
                  <div className="mb-4 p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Start New Chat
                    </h4>
                    
                    {/* User Selection */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Select User
                      </label>
                      <select
                        value={selectedUserForChat?.id || ''}
                        onChange={(e) => {
                          const user = availableUsers.find(u => u.id === e.target.value);
                          setSelectedUserForChat(user || null);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white text-sm"
                      >
                        <option value="">Choose a user...</option>
                        {availableUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {getUserDisplayName(user)} ({getUserRoleLabel(user.role)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Subject Input */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        Subject (Optional)
                      </label>
                      <input
                        type="text"
                        value={chatSubject}
                        onChange={(e) => setChatSubject(e.target.value)}
                        placeholder="Enter chat subject..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white text-sm"
                      />
                    </div>

                    {/* Form Actions */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          if (selectedUserForChat) {
                            handleStartChat(selectedUserForChat.id, chatSubject || undefined);
                          }
                        }}
                        disabled={!selectedUserForChat}
                        className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm"
                      >
                        Start Chat
                      </button>
                      <button
                        onClick={() => {
                          setShowNewChatForm(false);
                          setSelectedUserForChat(null);
                          setChatSubject('');
                        }}
                        className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Active Conversations */}
                {activeTab === 'active' && (
                  <div className="mb-4">
                    {conversations.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                        <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No conversations yet</p>
                        <p className="text-xs">Start a new chat to get started</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {conversations
                          .filter(conv => {
                            if (!searchQuery) return true;
                            const otherParticipantId = conv.participants.find(id => id !== currentUserId);
                            const otherUser = availableUsers.find(u => u.id === otherParticipantId);
                            const userName = getUserDisplayName(otherUser);
                            const subject = conv.subject || '';
                            return userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                   subject.toLowerCase().includes(searchQuery.toLowerCase());
                          })
                          .map((conv) => {
                            const otherParticipantId = conv.participants.find(id => id !== currentUserId);
                            const otherUser = availableUsers.find(u => u.id === otherParticipantId);
                            
                            return (
                              <div
                                key={conv.id}
                                className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              >
                                {/* Avatar */}
                                <AvatarDisplay user={otherUser} />
                                
                                {/* User info */}
                                <button
                                  onClick={() => handleOpenConversation(conv.id)}
                                  className="flex-1 min-w-0 text-left"
                                >
                                  <div className="flex items-center space-x-2">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {otherUser ? getUserDisplayName(otherUser) : 'Unknown User'}
                                    </p>
                                    {otherUser?.is_online && (
                                      <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {conv.subject || 'No subject'}
                                  </p>
                                </button>

                                {/* Action buttons */}
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => handleArchiveConversation(conv.id)}
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                    title="Archive conversation"
                                  >
                                    <Archive className="w-4 h-4 text-orange-500" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteConversation(conv.id)}
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                    title="Delete conversation"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}

                {/* Archived Conversations */}
                {activeTab === 'archived' && (
                  <div className="mb-4">
                    {archivedConversations.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                        <Archive className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No archived conversations</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {archivedConversations
                          .filter(conv => {
                            if (!searchQuery) return true;
                            const otherParticipantId = conv.participants.find(id => id !== currentUserId);
                            const otherUser = availableUsers.find(u => u.id === otherParticipantId);
                            const userName = getUserDisplayName(otherUser);
                            const subject = conv.subject || '';
                            return userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                   subject.toLowerCase().includes(searchQuery.toLowerCase());
                          })
                          .map((conv) => {
                            const otherParticipantId = conv.participants.find(id => id !== currentUserId);
                            const otherUser = availableUsers.find(u => u.id === otherParticipantId);
                            
                            return (
                              <div
                                key={conv.id}
                                className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              >
                                {/* Avatar */}
                                <AvatarDisplay user={otherUser} />
                                
                                {/* User info */}
                                <button
                                  onClick={() => handleOpenConversation(conv.id)}
                                  className="flex-1 min-w-0 text-left"
                                >
                                  <div className="flex items-center space-x-2">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {otherUser ? getUserDisplayName(otherUser) : 'Unknown User'}
                                    </p>
                                    {otherUser?.is_online && (
                                      <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {conv.subject || 'No subject'}
                                  </p>
                                </button>

                                {/* Action buttons */}
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => handleUnarchiveConversation(conv.id)}
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                    title="Unarchive conversation"
                                  >
                                    <ArchiveRestore className="w-4 h-4 text-blue-500" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteConversation(conv.id)}
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                    title="Delete conversation"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}

                {/* Deleted Conversations */}
                {activeTab === 'deleted' && (
                  <div className="mb-4">
                    {deletedConversations.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                        <Trash2 className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No deleted conversations</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {deletedConversations
                          .filter(conv => {
                            if (!searchQuery) return true;
                            const otherParticipantId = conv.participants.find(id => id !== currentUserId);
                            const otherUser = availableUsers.find(u => u.id === otherParticipantId);
                            const userName = getUserDisplayName(otherUser);
                            const subject = conv.subject || '';
                            return userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                   subject.toLowerCase().includes(searchQuery.toLowerCase());
                          })
                          .map((conv) => {
                            const otherParticipantId = conv.participants.find(id => id !== currentUserId);
                            const otherUser = availableUsers.find(u => u.id === otherParticipantId);
                            
                            return (
                              <div
                                key={conv.id}
                                className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors opacity-60"
                              >
                                {/* Avatar with deleted indicator */}
                                <div className="relative">
                                  <AvatarDisplay user={otherUser} />
                                  <Clock className="absolute -bottom-1 -right-1 w-3 h-3 text-gray-400" />
                                </div>
                                
                                {/* User info */}
                                <button
                                  onClick={() => handleOpenConversation(conv.id)}
                                  className="flex-1 min-w-0 text-left"
                                >
                                  <div className="flex items-center space-x-2">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                      {otherUser ? getUserDisplayName(otherUser) : 'Unknown User'}
                                    </p>
                                    {otherUser?.is_online && (
                                      <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {conv.subject || 'No subject'}
                                  </p>
                                </button>

                                {/* Action buttons */}
                                <div className="flex space-x-1">
                                  <button
                                    onClick={() => handleRestoreConversation(conv.id)}
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                    title="Restore conversation"
                                  >
                                    <ArchiveRestore className="w-4 h-4 text-green-500" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteConversation(conv.id)}
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                                    title="Delete forever"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      )}


    </>
  );
}
