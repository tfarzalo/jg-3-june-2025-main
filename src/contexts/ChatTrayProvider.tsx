import React, { createContext, useContext, useEffect, useState } from 'react';

export interface OpenChat {
  id: string;
  minimized: boolean;
  unread: number;
  title?: string;
}

interface ChatTrayContextType {
  openChats: OpenChat[];
  openChat: (id: string) => void;
  closeChat: (id: string) => void;
  toggleMinimize: (id: string) => void;
  setUnread: (id: string, count: number) => void;
  setTitle: (id: string, title: string) => void;
  autoOpenChatForMessage: (conversationId: string, senderName: string) => void;
}

const ChatTrayContext = createContext<ChatTrayContextType | undefined>(undefined);

const STORAGE_KEY = 'chat.tray.v1';

export function useChatTray() {
  const context = useContext(ChatTrayContext);
  if (context === undefined) {
    throw new Error('useChatTray must be used within a ChatTrayProvider');
  }
  return context;
}

interface ChatTrayProviderProps {
  children: React.ReactNode;
}

export function ChatTrayProvider({ children }: ChatTrayProviderProps) {
  const [openChats, setOpenChats] = useState<OpenChat[]>([]);

  // Load open chats from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setOpenChats(parsed);
        }
      }
    } catch (error) {
      console.error('Error loading chat tray state from localStorage:', error);
    }
  }, []);

  // Save open chats to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openChats));
    } catch (error) {
      console.error('Error saving chat tray state to localStorage:', error);
    }
  }, [openChats]);

  const openChat = (id: string) => {
    setOpenChats(prev => {
      const existing = prev.find(chat => chat.id === id);
      if (existing) {
        // If chat exists, ensure it's not minimized
        return prev.map(chat => 
          chat.id === id 
            ? { ...chat, minimized: false, unread: 0 }
            : chat
        );
      } else {
        // Add new chat
        return [...prev, { id, minimized: false, unread: 0 }];
      }
    });
  };

  const closeChat = (id: string) => {
    setOpenChats(prev => prev.filter(chat => chat.id !== id));
  };

  const toggleMinimize = (id: string) => {
    setOpenChats(prev => 
      prev.map(chat => 
        chat.id === id 
          ? { ...chat, minimized: !chat.minimized }
          : chat
      )
    );
  };

  const setUnread = (id: string, count: number) => {
    setOpenChats(prev => 
      prev.map(chat => 
        chat.id === id 
          ? { ...chat, unread: count }
          : chat
      )
    );
  };

  const setTitle = (id: string, title: string) => {
    setOpenChats(prev => 
      prev.map(chat => 
        chat.id === id 
          ? { ...chat, title }
          : chat
      )
    );
  };

  const autoOpenChatForMessage = (conversationId: string, senderName: string) => {
    setOpenChats(prev => {
      const existing = prev.find(chat => chat.id === conversationId);
      if (existing) {
        // Update existing chat
        return prev.map(chat =>
          chat.id === conversationId
            ? { 
                ...chat, 
                unread: existing.minimized ? chat.unread + 1 : 0, // Only increment if minimized
                minimized: false // Always un-minimize when new message arrives
              }
            : chat
        );
      } else {
        // Create new chat window for this conversation
        return [...prev, {
          id: conversationId,
          minimized: false,
          unread: 0, // Don't mark as unread since we're opening it
          title: senderName
        }];
      }
    });
  };

  const value: ChatTrayContextType = {
    openChats,
    openChat,
    closeChat,
    toggleMinimize,
    setUnread,
    setTitle,
    autoOpenChatForMessage,
  };

  return (
    <ChatTrayContext.Provider value={value}>
      {children}
    </ChatTrayContext.Provider>
  );
}

