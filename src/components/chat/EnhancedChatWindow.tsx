import React, { useState, useRef, useEffect } from 'react';
import { X, Minus, Send, MoreVertical, Archive, ArchiveRestore, Trash2, Phone, Video } from 'lucide-react';
import { useChatTray } from '../../contexts/ChatTrayProvider';
import { useAuth } from '../../contexts/AuthProvider';
import { supabase } from '../../utils/supabase';
import { getAvatarProps } from '../../utils/avatarUtils';
import { EnhancedChatApi } from '../../services/enhancedChatApi';

interface ChatWindowProps {
  conversationId: string;
  currentUserId: string;
}

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  last_seen?: string;
  is_online?: boolean;
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

interface Conversation {
  id: string;
  participants: string[];
  type: string;
  subject?: string;
  archived?: boolean;
  created_at: string;
  updated_at: string;
}

export function EnhancedChatWindow({ conversationId, currentUserId }: ChatWindowProps) {
  const { closeChat, toggleMinimize } = useChatTray();
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chatTitle, setChatTitle] = useState<string>('Chat');
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherParticipant, setOtherParticipant] = useState<User | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [sending, setSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user is online (within last 5 minutes)
  const isUserOnline = (lastSeen: string | null): boolean => {
    if (!lastSeen) return false;
    const lastSeenTime = new Date(lastSeen).getTime();
    const now = new Date().getTime();
    const fiveMinutes = 5 * 60 * 1000;
    return (now - lastSeenTime) < fiveMinutes;
  };

  // Load conversation data, participants, and messages
  useEffect(() => {
    const loadChatData = async () => {
      try {
        setIsLoading(true);
        
        // Load conversation details
        const { data: conversationData, error: convError } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', conversationId)
          .single();

        if (convError) throw convError;
        setConversation(conversationData);

        // Find the other participant (not the current user)
        const otherParticipantId = conversationData.participants.find(id => id !== currentUserId);
        
        if (otherParticipantId) {
          // Load the other participant's profile
          const { data: participantData, error: participantError } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, last_seen, avatar_url')
            .eq('id', otherParticipantId)
            .single();

          if (!participantError && participantData) {
            const participantWithStatus = {
              ...participantData,
              is_online: isUserOnline(participantData.last_seen)
            };
            setOtherParticipant(participantWithStatus);
            
            // Set chat title to just the participant name (subject will be shown separately)
            const title = participantData.full_name || participantData.email;
            setChatTitle(title);
          }
        }

        // Load messages for this conversation
        const { data: messagesData, error: messagesError } = await supabase
          .from('messages')
          .select(`
            *,
            sender:profiles!messages_sender_id_fkey(
              id,
              email,
              full_name,
              role,
              avatar_url
            )
          `)
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;
        setMessages(messagesData || []);

      } catch (error) {
        console.error('Error loading chat data:', error);
        setChatTitle(`Chat ${conversationId.slice(0, 8)}...`);
      } finally {
        setIsLoading(false);
      }
    };

    if (conversationId && currentUserId) {
      loadChatData();
    }
  }, [conversationId, currentUserId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing indicator
  const handleTyping = () => {
    setIsTyping(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !conversationId || !currentUserId || sending) return;
    
    try {
      setSending(true);
      
      // Insert the new message
      const { data: newMessage, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          body: inputValue.trim(),
          created_at: new Date().toISOString()
        })
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(
            id,
            email,
            full_name,
            role,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;

      // Add message to local state
      setMessages(prev => [...prev, newMessage]);
      
      // Update conversation's updated_at timestamp
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      setInputValue('');
      setIsTyping(false);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleArchive = async () => {
    try {
      await EnhancedChatApi.archiveConversation(conversationId);
      setShowOptions(false);
    } catch (error) {
      console.error('Error archiving conversation:', error);
    }
  };

  const handleUnarchive = async () => {
    try {
      await EnhancedChatApi.unarchiveConversation(conversationId);
      setShowOptions(false);
    } catch (error) {
      console.error('Error unarchiving conversation:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await EnhancedChatApi.deleteConversation(conversationId);
      closeChat(conversationId);
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-80 h-96 flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
            <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
          <div className="flex space-x-1">
            <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="flex-1 p-3">
          <div className="space-y-3">
            <div className="w-3/4 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="w-1/2 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            <div className="w-2/3 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 w-80 h-96 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
            {(() => {
              if (!otherParticipant) {
                return <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">U</span>;
              }
              
              const avatarProps = getAvatarProps(otherParticipant);
              return avatarProps.avatarUrl ? (
                <img
                  src={avatarProps.avatarUrl}
                  alt={otherParticipant.full_name || 'User'}
                  className="w-8 h-8 rounded-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `<span class="text-sm font-semibold text-gray-600 dark:text-gray-300">${avatarProps.initials}</span>`;
                    }
                  }}
                />
              ) : (
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
                  {avatarProps.initials}
                </span>
              );
            })()}
          </div>
          
          {/* Title and Subject */}
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {chatTitle}
            </h3>
            {conversation?.subject && (
              <p className="text-xs text-blue-600 dark:text-blue-400 truncate">
                {conversation.subject}
              </p>
            )}
            {otherParticipant && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {otherParticipant.is_online ? 'Online' : 'Offline'}
              </p>
            )}
          </div>
        </div>
        
        {/* Controls */}
        <div className="flex space-x-1">
          <button
            onClick={() => toggleMinimize(conversationId)}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowOptions(!showOptions)}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {/* Options dropdown */}
            {showOptions && (
              <div className="absolute right-0 top-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-2 z-10 min-w-32">
                <div className="flex flex-col space-y-1">
                  {conversation?.archived ? (
                    <button
                      onClick={handleUnarchive}
                      className="flex items-center space-x-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
                    >
                      <ArchiveRestore className="w-4 h-4" />
                      <span>Unarchive</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleArchive}
                      className="flex items-center space-x-2 px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg"
                    >
                      <Archive className="w-4 h-4" />
                      <span>Archive</span>
                    </button>
                  )}
                  <button
                    onClick={handleDelete}
                    className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={() => closeChat(conversationId)}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Start the conversation!</p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwnMessage = message.sender_id === currentUserId;
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const showDate = !prevMessage || 
              new Date(message.created_at).toDateString() !== new Date(prevMessage.created_at).toDateString();
            
            return (
              <div key={message.id}>
                {showDate && (
                  <div className="flex justify-center my-4">
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                      {formatDate(message.created_at)}
                    </span>
                  </div>
                )}
                
                <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[200px] rounded-2xl px-3 py-2 text-sm ${
                    isOwnMessage 
                      ? 'bg-blue-600 text-white rounded-br-md' 
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md'
                  }`}>
                    <p className="break-words">{message.body}</p>
                    <p className={`text-xs mt-1 ${
                      isOwnMessage 
                        ? 'text-blue-100' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        
        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl px-3 py-2 text-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSend} className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || sending}
            className="px-3 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>

      {/* Click outside to close options */}
      {showOptions && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowOptions(false)}
        />
      )}
    </div>
  );
}
