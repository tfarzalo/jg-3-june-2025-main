# Chat Integration Guide

This document explains how to integrate the new chat functionality into your existing React + Vite + TypeScript app.

## Components Created

1. **ChatTrayProvider** (`src/contexts/ChatTrayProvider.tsx`) - Manages open chat windows state
2. **ChatWindow** (`src/components/chat/ChatWindow.tsx`) - Individual chat conversation window
3. **ChatDock** (`src/components/chat/ChatDock.tsx`) - Fixed bottom-right dock with chat tabs
4. **NewChatModal** (`src/components/chat/NewChatModal.tsx`) - Modal to start new conversations
5. **TestChatButton** (`src/components/chat/TestChatButton.tsx`) - DEV-only testing button
6. **useCurrentUserId** (`src/hooks/useCurrentUserId.ts`) - Hook to get current user ID

## Services Created

1. **chat.ts** (`src/services/chat.ts`) - Realtime chat functionality (typing, presence)
2. **chatApi.ts** (`src/services/chatApi.ts`) - Chat API operations (start DM, post message, etc.)

## Integration Steps

### 1. Wrap your app with ChatTrayProvider

In your `src/App.tsx`, wrap the protected routes with `ChatTrayProvider`:

```tsx
import { ChatTrayProvider } from './contexts/ChatTrayProvider';

// Protected layout wrapper
const ProtectedLayout = () => (
  <JobDataProvider>
    <AuthProvider>
      <UserRoleProvider>
        <SubcontractorPreviewProvider>
          <ChatTrayProvider>
            <ProtectedRoute />
          </ChatTrayProvider>
        </SubcontractorPreviewProvider>
      </UserRoleProvider>
    </AuthProvider>
  </JobDataProvider>
);
```

### 2. Add ChatDock to MainLayout

In your `src/components/ui/MainLayout.tsx`, add the ChatDock at the end:

```tsx
import { ChatDock } from '../chat/ChatDock';

export function MainLayout({ children }: MainLayoutProps) {
  // ... existing code ...

  return (
    <>
      {/* User Login Alerts */}
      <UserLoginAlertManager />
      
      {/* Offline Status */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-2 text-center z-50">
          <span>You are currently offline. Some features may not work properly.</span>
        </div>
      )}
      
      {/* Page Content */}
      <Suspense fallback={
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      }>
        {children}
      </Suspense>

      {/* Chat Dock - Fixed bottom-right */}
      <ChatDock />
    </>
  );
}
```

### 3. Add NewChatModal and TestChatButton to Topbar

In your `src/components/ui/Topbar.tsx`, add the chat buttons in the action buttons section:

```tsx
import { NewChatModal } from '../chat/NewChatModal';
import { TestChatButton } from '../chat/TestChatButton';

// In the action buttons section (around line 250):
{/* Action buttons - only show for non-subcontractors */}
{!isSubcontractor && !showOnlyProfile && (
  <>
    <button
      onClick={() => setSearchOpen(true)}
      className="relative w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-[#1E293B] text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#2D3B4E] transition-colors"
      aria-label="Search"
    >
      <Search className="h-5 w-5" />
    </button>
    
    {/* Add NewChatModal here */}
    <NewChatModal currentUserId={session?.user.id || ''} />
    
    {/* Add TestChatButton here (DEV only) */}
    <TestChatButton currentUserId={session?.user.id || ''} />
    
    <button 
      onClick={() => navigate('/dashboard/sub-scheduler')}
      className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-4 py-2 rounded-lg flex items-center transition-colors"
    >
      <Calendar className="h-4 w-4 mr-2" />
      Schedule
    </button>
    {/* ... other buttons ... */}
  </>
)}
```

## Database Schema Requirements

The chat system expects these tables to exist:

### conversations
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participants UUID[] NOT NULL,
  type TEXT DEFAULT 'dm',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### messages
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### message_reads
```sql
CREATE TABLE message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, message_id, user_id)
);
```

## Realtime Configuration

Ensure your Supabase project has:

1. **Realtime enabled** for the `messages` and `notifications` tables
2. **RLS policies** that allow users to read/write messages in conversations they're part of
3. **Private channels** configured for the `chat:<conversation_id>` topics

## Usage Examples

### Starting a new chat
```tsx
import { useChatTray } from '@/contexts/ChatTrayProvider';

function MyComponent() {
  const { openChat } = useChatTray();
  
  const handleStartChat = async (userId: string) => {
    try {
      const conversationId = await startDM(userId);
      openChat(conversationId);
    } catch (error) {
      console.error('Failed to start chat:', error);
    }
  };
}
```

### Listening to chat events
```tsx
import { listenToConversation, joinChatTopic } from '@/services/chat';

useEffect(() => {
  // Listen to new messages
  const messageSub = listenToConversation(conversationId, (message) => {
    console.log('New message:', message);
  });
  
  // Join chat topic for typing indicators and presence
  const topicSub = joinChatTopic(conversationId, currentUserId, {
    onTyping: (userId, isTyping) => {
      console.log(`${userId} is ${isTyping ? 'typing' : 'not typing'}`);
    },
    onPresence: (userId, online) => {
      console.log(`${userId} is ${online ? 'online' : 'offline'}`);
    }
  });
  
  return () => {
    messageSub.unsubscribe();
    topicSub.leave();
  };
}, [conversationId, currentUserId]);
```

## Testing

1. **Test Chat Button**: Only visible in development mode (`import.meta.env.DEV === true`)
2. **Test Users**: 
   - Admin: `design@thunderlightmedia.com` (ID: `e73e8b31-1c9c-4b56-97be-d85dd30ca26d`)
   - Subcontractor: `sub10@jgapp.com` (ID: `fdb2a6f9-bb35-4dc9-a2c9-f9b87c1b1a46`)

## Features

- ✅ Real-time messaging with Supabase Realtime
- ✅ Typing indicators
- ✅ Presence tracking
- ✅ Unread message counts
- ✅ Minimizable chat windows
- ✅ Role-based access control (subcontractors can only DM admins/JG management)
- ✅ Persistent chat tray state (localStorage)
- ✅ Keyboard shortcuts (Enter to send, Shift+Enter for newline)
- ✅ Auto-scroll to bottom for new messages
- ✅ Read receipts

## Troubleshooting

1. **Import errors**: Ensure all import paths use `@/` alias
2. **Realtime not working**: Check Supabase project settings and RLS policies
3. **Chat windows not appearing**: Verify ChatTrayProvider is wrapping your app
4. **Permission errors**: Check user roles and RLS policies for conversations/messages tables

