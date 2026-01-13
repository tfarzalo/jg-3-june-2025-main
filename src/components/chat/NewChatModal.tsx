import React, { useState, useEffect } from 'react';
import { Search, User, X, MessageCircle } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import { startDM } from '../../services/chatApi';
import { useChatTray } from '../../contexts/ChatTrayProvider';
import { toast } from 'sonner';
import { getAvatarProps } from '../../utils/avatarUtils';

interface NewChatModalProps {
  currentUserId: string;
  buttonStyle?: 'default' | 'icon-only';
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  avatar_url?: string | null;
}

export function NewChatModal({ currentUserId, buttonStyle = 'default' }: NewChatModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  
  const { openChat } = useChatTray();

  // Load current user's role
  useEffect(() => {
    const loadCurrentUserRole = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUserId)
          .single();
        
        if (error) {
          console.error('Error loading user role:', error);
        } else {
          setCurrentUserRole(data.role);
        }
      } catch (error) {
        console.error('Error loading user role:', error);
      } finally {
        setIsLoadingRole(false);
      }
    };

    if (currentUserId) {
      loadCurrentUserRole();
    }
  }, [currentUserId]);

  // Search users
  useEffect(() => {
    if (!searchQuery.trim() || !currentUserRole) {
      setSearchResults([]);
      return;
    }

    const searchUsers = async () => {
      setIsSearching(true);
      try {
        let query = supabase
          .from('profiles')
          .select('id, email, full_name, role, avatar_url')
          .neq('id', currentUserId)
          .or(`email.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
          .limit(20);

        // Apply role restrictions for subcontractors
        if (currentUserRole === 'subcontractor') {
          query = query.in('role', ['admin', 'jg_management']);
        }

        const { data, error } = await query;

        if (error) {
          console.error('Error searching users:', error);
          toast.error('Failed to search users');
        } else {
          setSearchResults(data || []);
        }
      } catch (error) {
        console.error('Error searching users:', error);
        toast.error('Failed to search users');
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, currentUserId, currentUserRole]);

  const handleStartChat = async (selectedUserId: string) => {
    try {
      const conversationId = await startDM(selectedUserId);
      openChat(conversationId);
      setIsOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      toast.success('Chat started successfully');
    } catch (error: any) {
      console.error('Error starting chat:', error);
      
      // Handle subcontractor restriction error
      if (error.message.includes('Subcontractors cannot chat with other subcontractors')) {
        toast.error('Subcontractors can only chat with Admin and JG Management users');
      } else {
        toast.error('Failed to start chat');
      }
    }
  };

  const getUserDisplayName = (user: UserProfile) => {
    return user.full_name || user.email;
  };

  const getUserRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin';
      case 'jg_management':
        return 'JG Management';
      case 'subcontractor':
        return 'Subcontractor';
      default:
        return role;
    }
  };

  if (isLoadingRole) {
    return null; // Don't render until we know the user's role
  }

  return (
    <>
      {/* New Chat Button */}
      {buttonStyle === 'icon-only' ? (
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
          title="Start new conversation"
        >
          <MessageCircle className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center space-x-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      )}

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={() => setIsOpen(false)}
            />

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              {/* Header */}
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 flex items-center justify-between">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  Start New Chat
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
                {/* Search input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by email or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  />
                </div>

                {/* Search results */}
                <div className="mt-4 max-h-64 overflow-y-auto">
                  {isSearching ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Searching...</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-2">
                      {searchResults.map((user) => {
                        const avatarProps = getAvatarProps(user);
                        return (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                            onClick={() => handleStartChat(user.id)}
                          >
                            <div className="flex items-center space-x-3">
                              {/* Avatar with image or initials */}
                              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                                {avatarProps.avatarUrl ? (
                                  <img
                                    src={avatarProps.avatarUrl}
                                    alt={user.full_name || user.email}
                                    className="w-8 h-8 rounded-full object-cover"
                                    onError={(e) => {
                                      // Fallback to initials if image fails
                                      const target = e.currentTarget;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        const span = document.createElement('span');
                                        span.className = 'text-xs font-medium text-gray-600 dark:text-gray-300';
                                        span.textContent = avatarProps.initials;
                                        parent.appendChild(span);
                                      }
                                    }}
                                  />
                                ) : (
                                  <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                    {avatarProps.initials}
                                  </span>
                                )}
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {getUserDisplayName(user)}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {user.email}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                              {getUserRoleLabel(user.role)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : searchQuery.trim() ? (
                    <div className="text-center py-4">
                      <p className="text-gray-500 dark:text-gray-400">No users found</p>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-500 dark:text-gray-400">Start typing to search for users</p>
                    </div>
                  )}
                </div>

                {/* Role restriction notice */}
                {currentUserRole === 'subcontractor' && (
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      As a subcontractor, you can only start chats with administrators and JG management.
                    </p>
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
