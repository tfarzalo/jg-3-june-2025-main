import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Plus, X, Minus, ArrowLeft, Search, Send, Paperclip } from 'lucide-react';
import { useChatTray } from '../../contexts/ChatTrayProvider';
import { useAuth } from '../../contexts/AuthProvider';
import { useNavigate } from 'react-router-dom';
import { supabase, getAvatarUrl } from '../../utils/supabase';
import { getAvatarProps } from '../../utils/avatarUtils';
import { toast } from 'sonner';
import { useUnreadMessages } from '../../contexts/UnreadMessagesProvider';

interface ChatUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string | null;
}

interface Conversation {
  id: string;
  participants: string[];
  subject?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: ChatUser;
}

type ViewMode = 'list' | 'chat' | 'newChat' | 'selectSubject';

export function ChatMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openChats, openChat, closeChat, toggleMinimize, setTitle } = useChatTray();
  const { unreadCount, markAsRead } = useUnreadMessages();
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatTitles, setChatTitles] = useState<Record<string, string>>({});
  const [chatUsers, setChatUsers] = useState<Record<string, ChatUser>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // New chat state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [chatSubject, setChatSubject] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  
  // Chat view state
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // Load chat info for open chats
  useEffect(() => {
    const loadChatInfo = async () => {
      if (!user?.id || openChats.length === 0) return;

      try {
        const titles: Record<string, string> = { ...chatTitles };
        const usersMap: Record<string, ChatUser> = { ...chatUsers };
        
        const chatsToLoad = openChats.filter(chat => !chatTitles[chat.id]);
        if (chatsToLoad.length === 0) return;
        
        for (const chat of chatsToLoad) {
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
                usersMap[chat.id] = participantData;
                
                const title = conversationData.subject 
                  ? `${participantData.full_name || participantData.email} - ${conversationData.subject}`
                  : participantData.full_name || participantData.email;
                titles[chat.id] = title;
              } else {
                titles[chat.id] = `Chat ${chat.id.slice(0, 8)}...`;
              }
            } else {
              titles[chat.id] = `Chat ${chat.id.slice(0, 8)}...`;
            }
          } catch (error) {
            console.error(`Error loading chat ${chat.id}:`, error);
            titles[chat.id] = `Chat ${chat.id.slice(0, 8)}...`;
          }
        }
        
        setChatTitles(titles);
        setChatUsers(usersMap);
      } catch (error) {
        console.error('Error loading chat info:', error);
      }
    };

    loadChatInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openChats.length, openChats.map(c => c.id).join(','), user?.id]);

  if (!user) return null;

  return (
    <>
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
          <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-[#1E293B] rounded-lg shadow-lg z-50 overflow-hidden border border-gray-200 dark:border-[#2D3B4E]">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-[#2D3B4E] flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Chats</h3>
              <button
                onClick={() => {
                  navigate('/messaging');
                  setIsOpen(false);
                }}
                className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                title="Start new chat"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Chat List */}
            <div className="max-h-96 overflow-y-auto">
              {openChats.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">No open chats</p>
                  <button
                    onClick={() => {
                      navigate('/messaging');
                      setIsOpen(false);
                    }}
                    className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Start a conversation
                  </button>
                </div>
              ) : (
                openChats.map(chat => {
                  const chatUser = chatUsers[chat.id];
                  const avatarProps = chatUser ? getAvatarProps(chatUser) : null;
                  
                  return (
                    <div
                      key={chat.id}
                      className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-[#2D3B4E] transition-colors ${
                        chat.unread > 0 ? 'bg-green-50 dark:bg-green-900/10' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          {avatarProps?.avatarUrl ? (
                            <img
                              src={avatarProps.avatarUrl}
                              alt={chatUser.full_name || 'User'}
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent && avatarProps) {
                                  const span = document.createElement('div');
                                  span.className = 'w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium';
                                  span.textContent = avatarProps.initials;
                                  parent.appendChild(span);
                                }
                              }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                              {avatarProps?.initials || 'U'}
                            </div>
                          )}
                        </div>

                        {/* Chat Info */}
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => {
                              if (chat.minimized) {
                                toggleMinimize(chat.id);
                              }
                              setIsOpen(false);
                            }}
                            className="text-left w-full"
                          >
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {chatTitles[chat.id] || chat.title || 'Loading...'}
                            </p>
                            {chat.unread > 0 && (
                              <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                                {chat.unread} new {chat.unread === 1 ? 'message' : 'messages'}
                              </p>
                            )}
                          </button>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => toggleMinimize(chat.id)}
                            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-[#3D4B5E] text-gray-500 dark:text-gray-400 transition-colors"
                            title={chat.minimized ? "Restore" : "Minimize"}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => closeChat(chat.id)}
                            className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-[#3D4B5E] text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Close chat"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
