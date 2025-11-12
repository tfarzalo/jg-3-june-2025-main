import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/supabase';
import { startDM, postMessage } from '@/services/chatApi';
import { listenToConversation, joinChatTopic, setTyping, trackOnline } from '@/services/chat';
import { toast } from 'sonner';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'success' | 'error' | 'presence' | 'typing' | 'db_insert';
  message: string;
  data?: any;
}

export default function DevChatHarness() {
  const [conversationId, setConversationId] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  
  const conversationSubscriptionRef = useRef<any>(null);
  const chatTopicSubscriptionRef = useRef<any>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Test user IDs (these should match your actual database)
  const TEST_ADMIN_ID = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d'; // design@thunderlightmedia.com
  const TEST_SUB_ID = 'fdb2a6f9-bb35-4dc9-a2c9-f9b87c1b1a46'; // sub10@jgapp.com

  useEffect(() => {
    // Get current user ID
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        addLog('info', `Current user: ${user.email} (${user.id})`);
      } else {
        addLog('error', 'No user signed in');
      }
    };

    getCurrentUser();
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom of logs
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (type: LogEntry['type'], message: string, data?: any) => {
    const newLog: LogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      data
    };
    setLogs(prev => [...prev, newLog]);
  };

  const handleStartDM = async () => {
    try {
      if (!currentUserId) {
        addLog('error', 'No user signed in');
        return;
      }

      addLog('info', 'Starting DM with Sub10...');
      
      // Use the RPC function start_dm
      const cid = await startDM(TEST_SUB_ID);
      setConversationId(cid);
      addLog('success', `DM started successfully! Conversation ID: ${cid}`);
      toast.success('DM started successfully!');
    } catch (error: any) {
      addLog('error', `Failed to start DM: ${error.message}`);
      toast.error('Failed to start DM');
    }
  };

  const handleSendTestMessage = async () => {
    if (!conversationId || !currentUserId) {
      addLog('error', 'No conversation ID or user ID');
      return;
    }

    try {
      addLog('info', 'Sending test message...');
      
      // Use the RPC function post_message
      const messageId = await postMessage(conversationId, 'Test from harness');
      addLog('success', `Message sent! Message ID: ${messageId}`);
      toast.success('Test message sent!');
    } catch (error: any) {
      addLog('error', `Failed to send message: ${error.message}`);
      toast.error('Failed to send message');
    }
  };

  const handleJoinPrivateTopic = async () => {
    if (!conversationId || !currentUserId) {
      addLog('error', 'No conversation ID or user ID');
      return;
    }

    try {
      if (isJoined) {
        // Leave topic
        if (chatTopicSubscriptionRef.current) {
          chatTopicSubscriptionRef.current.leave();
          chatTopicSubscriptionRef.current = null;
        }
        setIsJoined(false);
        addLog('info', 'Left private chat topic');
        return;
      }

      addLog('info', 'Joining private chat topic...');
      
      const subscription = joinChatTopic(conversationId, currentUserId, {
        onTyping: (userId, isTyping) => {
          addLog('typing', `${userId} is ${isTyping ? 'typing' : 'not typing'}`);
        },
        onPresence: (userId, online, lastSeen) => {
          addLog('presence', `${userId} is ${online ? 'online' : 'offline'}${lastSeen ? ` (last seen: ${lastSeen})` : ''}`);
        }
      });

      chatTopicSubscriptionRef.current = subscription;
      setIsJoined(true);
      
      // Track as online
      trackOnline(conversationId, currentUserId);
      addLog('success', 'Joined private chat topic and tracking online status');
      toast.success('Joined private chat topic!');
    } catch (error: any) {
      addLog('error', `Failed to join topic: ${error.message}`);
      toast.error('Failed to join topic');
    }
  };

  const handleToggleTyping = async () => {
    if (!conversationId || !currentUserId) {
      addLog('error', 'No conversation ID or user ID');
      return;
    }

    try {
      const newTypingState = !isTyping;
      setIsTyping(newTypingState);
      setTyping(conversationId, currentUserId, newTypingState);
      addLog('typing', `Typing ${newTypingState ? 'ON' : 'OFF'}`);
    } catch (error: any) {
      addLog('error', `Failed to set typing: ${error.message}`);
    }
  };

  const handleListenDBInserts = async () => {
    if (!conversationId) {
      addLog('error', 'No conversation ID set');
      return;
    }

    try {
      if (isListening) {
        // Stop listening
        if (conversationSubscriptionRef.current) {
          conversationSubscriptionRef.current.unsubscribe();
          conversationSubscriptionRef.current = null;
        }
        setIsListening(false);
        addLog('info', 'Stopped listening to DB inserts');
        return;
      }

      addLog('info', 'Starting to listen to DB inserts...');
      
      const subscription = listenToConversation(conversationId, (newMessage) => {
        addLog('db_insert', `New message inserted: ${newMessage.body}`, {
          messageId: newMessage.id,
          senderId: newMessage.sender_id,
          timestamp: newMessage.created_at
        });
      });

      conversationSubscriptionRef.current = subscription;
      setIsListening(true);
      addLog('success', 'Now listening to DB inserts for this conversation');
      toast.success('Listening to DB inserts!');
    } catch (error: any) {
      addLog('error', `Failed to start listening: ${error.message}`);
      toast.error('Failed to start listening');
    }
  };

  const handleMarkRead = async () => {
    if (!conversationId || !currentUserId) {
      addLog('error', 'No conversation ID or user ID');
      return;
    }

    try {
      // Get the last message ID
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !messages) {
        addLog('error', 'No messages found to mark as read');
        return;
      }

      // Check if already marked as read
      const { data: existingRead, error: checkError } = await supabase
        .from('message_reads')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('message_id', messages.id)
        .eq('user_id', currentUserId)
        .single();

      if (existingRead && !checkError) {
        addLog('info', 'Message already marked as read');
        return;
      }

      // Use the markRead function
      await markRead(conversationId, messages.id);
      addLog('success', `Marked message ${messages.id} as read`);
      toast.success('Message marked as read!');
    } catch (error: any) {
      addLog('error', `Failed to mark as read: ${error.message}`);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'presence': return '👤';
      case 'typing': return '⌨️';
      case 'db_insert': return '💾';
      default: return 'ℹ️';
    }
  };

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'presence': return 'text-blue-600';
      case 'typing': return 'text-purple-600';
      case 'db_insert': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  // Only render in development mode
  if (import.meta.env.DEV !== true) {
    return null;
  }

  return (
    <div className="fixed inset-4 bg-white border-2 border-red-500 rounded-lg shadow-2xl z-50 overflow-hidden">
      <div className="bg-red-500 text-white p-4">
        <h1 className="text-xl font-bold">🚨 DEV-ONLY Chat Test Harness 🚨</h1>
        <p className="text-sm opacity-90">Testing chat functionality without DB changes</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Input for Conversation ID */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Conversation ID:
          </label>
          <input
            type="text"
            value={conversationId}
            onChange={(e) => setConversationId(e.target.value)}
            placeholder="Enter conversation ID or use Start DM button"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Test Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleStartDM}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Start DM (Admin → Sub10)
          </button>

          <button
            onClick={handleSendTestMessage}
            disabled={!conversationId}
            className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send Test Message
          </button>

          <button
            onClick={handleJoinPrivateTopic}
            disabled={!conversationId}
            className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 ${
              isJoined 
                ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500' 
                : 'bg-purple-500 hover:bg-purple-600 focus:ring-purple-500'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isJoined ? 'Leave Private Topic' : 'Join Private Topic'}
          </button>

          <button
            onClick={handleToggleTyping}
            disabled={!conversationId}
            className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 ${
              isTyping 
                ? 'bg-orange-500 hover:bg-orange-600 focus:ring-orange-500' 
                : 'bg-gray-500 hover:bg-gray-600 focus:ring-gray-500'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            Typing {isTyping ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={handleListenDBInserts}
            disabled={!conversationId}
            className={`px-4 py-2 rounded-md focus:outline-none focus:ring-2 ${
              isListening 
                ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500' 
                : 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500'
            } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isListening ? 'Stop Listening' : 'Listen DB Inserts'}
          </button>

          <button
            onClick={handleMarkRead}
            disabled={!conversationId}
            className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Mark Read
          </button>
        </div>

        {/* Status Info */}
        <div className="bg-gray-100 p-3 rounded-md text-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <strong>Current User:</strong> {currentUserId || 'Not signed in'}
            </div>
            <div>
              <strong>Conversation ID:</strong> {conversationId || 'Not set'}
            </div>
            <div>
              <strong>Private Topic:</strong> {isJoined ? '✅ Joined' : '❌ Not joined'}
            </div>
            <div>
              <strong>DB Listening:</strong> {isListening ? '✅ Active' : '❌ Inactive'}
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="block text-sm font-medium text-gray-700">
              Event Log:
            </label>
            <button
              onClick={clearLogs}
              className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
            >
              Clear Logs
            </button>
          </div>
          
          <div className="bg-gray-900 text-green-400 p-3 rounded-md h-64 overflow-y-auto font-mono text-sm">
            {logs.length === 0 ? (
              <div className="text-gray-500">No events logged yet...</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="mb-2">
                  <span className="text-gray-400">[{log.timestamp}]</span>{' '}
                  <span className={getLogColor(log.type)}>
                    {getLogIcon(log.type)} {log.message}
                  </span>
                  {log.data && (
                    <div className="ml-4 text-xs text-gray-500">
                      {JSON.stringify(log.data, null, 2)}
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
