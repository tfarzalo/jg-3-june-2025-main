import React, { useState, useEffect } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { useChatTray } from '../../contexts/ChatTrayProvider';
import { ChatWindow } from './ChatWindow';
import { useAuth } from '../../contexts/AuthProvider';
import { supabase } from '../../utils/supabase';
import { getAvatarProps } from '../../utils/avatarUtils';

interface ChatInfo {
  id: string;
  title: string;
}

interface User {
  id: string;
  email: string;
  full_name: string | null;
  last_seen?: string;
  is_online?: boolean;
  avatar_url?: string | null;
}

export function ChatDock() {
  const { openChats, toggleMinimize, closeChat } = useChatTray();
  const { user } = useAuth();
  const [chatTitles, setChatTitles] = useState<Record<string, string>>({});
  const [chatUsers, setChatUsers] = useState<Record<string, User>>({});

  // Safely get user ID
  const currentUserId = user?.id ? (typeof user.id === 'string' ? user.id : String(user.id)) : null;

  // Check if user is online (within last 5 minutes)
  const isUserOnline = (lastSeen: string | null): boolean => {
    if (!lastSeen) return false;
    const lastSeenTime = new Date(lastSeen).getTime();
    const now = new Date().getTime();
    const fiveMinutes = 5 * 60 * 1000;
    return (now - lastSeenTime) < fiveMinutes;
  };

  // Load chat titles and user info - optimized to only load new/changed chats
  useEffect(() => {
    const loadChatInfo = async () => {
      if (!user?.id || openChats.length === 0) return;

      try {
        const titles: Record<string, string> = { ...chatTitles };
        const usersMap: Record<string, User> = { ...chatUsers };
        
        // Only load info for chats we don't already have
        const chatsToLoad = openChats.filter(chat => !chatTitles[chat.id]);
        
        if (chatsToLoad.length === 0) return; // All chats already loaded
        
        // Load each new conversation's data
        for (const chat of chatsToLoad) {
          try {
            // Load conversation details
            const { data: conversationData, error: convError } = await supabase
              .from('conversations')
              .select('*')
              .eq('id', chat.id)
              .single();

            if (convError) throw convError;

            // Find the other participant (not the current user)
            const otherParticipantId = conversationData.participants.find(id => id !== user.id);
            
            if (otherParticipantId) {
              // Load the other participant's profile
              const { data: participantData, error: participantError } = await supabase
                .from('profiles')
                .select('id, email, full_name, last_seen, avatar_url')
                .eq('id', otherParticipantId)
                .single();

              if (!participantError && participantData) {
                const participantWithStatus = {
                  ...participantData,
                  is_online: isUserOnline(participantData.last_seen)
                };
                
                usersMap[chat.id] = participantWithStatus;
                
                // Set chat title based on participant name and subject
                const title = conversationData.subject 
                  ? `${participantData.full_name || participantData.email} - ${conversationData.subject}`
                  : participantData.full_name || participantData.email;
                titles[chat.id] = title;
              } else {
                // Fallback if participant not found
                titles[chat.id] = `Chat ${chat.id.slice(0, 8)}...`;
              }
            } else {
              // Fallback if no other participant found
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
  }, [openChats.length, openChats.map(c => c.id).join(','), user?.id]); // Only reload when chat IDs change

  if (!currentUserId || openChats.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Chat Windows - positioned above the dock */}
      <div className="absolute bottom-full right-0 mb-2 space-y-2">
        {openChats
          .filter(chat => !chat.minimized)
          .map(chat => (
            <ChatWindow
              key={chat.id}
              conversationId={chat.id}
              currentUserId={currentUserId}
            />
          ))}
      </div>

      {/* Dock with tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2">
        <div className="flex items-center space-x-2">
          {openChats.map(chat => {
            const chatUser = chatUsers[chat.id];
            const isOnline = chatUser?.is_online;
            
            return (
              <div
                key={chat.id}
                className={`relative flex items-center space-x-2 rounded-lg px-3 py-1.5 min-w-0 cursor-pointer transition-all duration-200 ${
                  chat.unread > 0 
                    ? 'bg-green-100 dark:bg-green-900/30 ring-2 ring-green-500 dark:ring-green-400' 
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                onClick={() => toggleMinimize(chat.id)}
                style={chat.unread > 0 ? {
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                } : undefined}
              >
                {/* Avatar - smaller size with proper image handling */}
                <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {(() => {
                    if (!chatUser) {
                      return <span className="text-xs font-medium text-gray-600 dark:text-gray-300">U</span>;
                    }
                    
                    const avatarProps = getAvatarProps(chatUser);
                    
                    if (avatarProps.avatarUrl) {
                      return (
                        <img
                          src={avatarProps.avatarUrl}
                          alt={chatUser.full_name || 'User'}
                          className="w-6 h-6 rounded-full object-cover"
                          onError={(e) => {
                            // Fallback to initials if image fails to load
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
                      );
                    }
                    
                    return (
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        {avatarProps.initials}
                      </span>
                    );
                  })()}
                </div>
                
                {/* Username - wider to fit full name */}
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-28">
                  {chatTitles[chat.id] || chat.title || `${chat.id.slice(0, 8)}...`}
                </span>
                
                {/* Unread badge - smaller size */}
                {chat.unread > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center min-w-0">
                    {chat.unread > 99 ? '99+' : chat.unread}
                  </div>
                )}
                
                {/* Close button - smaller padding */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeChat(chat.id);
                  }}
                  className="p-0.5 hover:bg-gray-300 dark:hover:bg-gray-500 rounded transition-colors flex-shrink-0"
                  title="Close chat"
                >
                  <X className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
