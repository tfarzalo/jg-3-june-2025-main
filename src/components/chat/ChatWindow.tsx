import React, { useState, useRef, useEffect } from 'react';
import { X, Minus, Send } from 'lucide-react';
import { useChatTray } from '../../contexts/ChatTrayProvider';
import { useAuth } from '../../contexts/AuthProvider';
import { supabase } from '../../utils/supabase';
import { getAvatarProps } from '../../utils/avatarUtils';

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
  created_at: string;
  updated_at: string;
}

export function ChatWindow({ conversationId, currentUserId }: ChatWindowProps) {
  const { closeChat, toggleMinimize } = useChatTray();
  const { user } = useAuth();
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [chatTitle, setChatTitle] = useState<string>('Chat');
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [otherParticipant, setOtherParticipant] = useState<User | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !conversationId || !currentUserId) return;
    
    try {
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
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
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
                    // Fallback to initials if image fails to load
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
            {otherParticipant && !conversation?.subject && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {otherParticipant.is_online ? 'Online' : 'Offline'}
              </p>
            )}
            {otherParticipant && conversation?.subject && (
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
          messages.map(message => {
            const isOwnMessage = message.sender_id === currentUserId;
            
            return (
              <div key={message.id} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[200px] rounded-lg px-3 py-2 text-sm ${
                  isOwnMessage 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}>
                  <p className="break-words">{message.body}</p>
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

      {/* Input */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSend} className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
