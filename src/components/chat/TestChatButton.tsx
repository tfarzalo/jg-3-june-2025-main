import React from 'react';
import { MessageCircle, TestTube } from 'lucide-react';
import { startDM, postMessage } from '@/services/chatApi';
import { useChatTray } from '@/contexts/ChatTrayProvider';
import { toast } from 'sonner';

interface TestChatButtonProps {
  currentUserId: string;
}

// Test user IDs (these should match your actual database)
const TEST_ADMIN_ID = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d'; // design@thunderlightmedia.com
const TEST_SUB_ID = 'fdb2a6f9-bb35-4dc9-a2c9-f9b87c1b1a46'; // sub10@jgapp.com

export function TestChatButton({ currentUserId }: TestChatButtonProps) {
  const { openChat } = useChatTray();

  // Only render in development mode
  if (import.meta.env.DEV !== true) {
    return null;
  }

  const handleTestChat = async () => {
    try {
      if (currentUserId !== TEST_ADMIN_ID) {
        toast.error('Sign in as design@thunderlightmedia.com to run the test');
        return;
      }

      // Start DM with test subcontractor
      const conversationId = await startDM(TEST_SUB_ID);
      
      // Send test message
      await postMessage(conversationId, 'Hello Sub10 — test chat from Design TL!');
      
      // Open the chat window
      openChat(conversationId);
      
      toast.success('Test chat started successfully!');
    } catch (error) {
      console.error('Error starting test chat:', error);
      toast.error('Failed to start test chat');
    }
  };

  return (
    <button
      onClick={handleTestChat}
      className="inline-flex items-center space-x-2 px-3 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors"
      title="DEV ONLY: Test chat functionality"
    >
      <TestTube className="w-4 h-4" />
      <span>Test Chat</span>
    </button>
  );
}
