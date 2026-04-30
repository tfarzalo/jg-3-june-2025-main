import React, { createContext, useContext, useState, useCallback } from 'react';

export interface HughMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface HughContextType {
  isOpen: boolean;
  openHugh: () => void;
  closeHugh: () => void;
  toggleHugh: () => void;
  messages: HughMessage[];
  addMessage: (role: 'user' | 'assistant', content: string) => string;
  updateMessage: (id: string, content: string, isLoading?: boolean) => void;
  clearMessages: () => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
}

const HughContext = createContext<HughContextType | undefined>(undefined);

export function useHugh() {
  const ctx = useContext(HughContext);
  if (!ctx) throw new Error('useHugh must be used within HughProvider');
  return ctx;
}

export function HughProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<HughMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const openHugh = useCallback(() => setIsOpen(true), []);
  const closeHugh = useCallback(() => setIsOpen(false), []);
  const toggleHugh = useCallback(() => setIsOpen(v => !v), []);

  const addMessage = useCallback((role: 'user' | 'assistant', content: string): string => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const msg: HughMessage = { id, role, content, timestamp: new Date() };
    setMessages(prev => [...prev, msg]);
    return id;
  }, []);

  const updateMessage = useCallback((id: string, content: string, isLoading = false) => {
    setMessages(prev =>
      prev.map(m => m.id === id ? { ...m, content, isLoading } : m)
    );
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  return (
    <HughContext.Provider value={{
      isOpen, openHugh, closeHugh, toggleHugh,
      messages, addMessage, updateMessage, clearMessages,
      isLoading, setIsLoading,
    }}>
      {children}
    </HughContext.Provider>
  );
}
