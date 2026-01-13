# Real-Time Presence and Last-Seen Implementation

This document describes the implementation of real-time presence and last-seen functionality for Users in the application.

## Overview

The system provides:
- **Real-time presence**: Shows who is currently online using Supabase Realtime Presence
- **Last-seen tracking**: Persists when users were last active in the database
- **Minimal server writes**: Presence is ephemeral (websocket), last-seen is persisted every 5 minutes

## Architecture

### 1. Database Changes

The `profiles` table has been extended with a `last_seen` column:

```sql
-- Run this migration:
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen timestamptz;

-- Enable RLS if not already enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to update their own last_seen
CREATE POLICY "profiles: self-update last_seen" ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);
```

### 2. Core Files

#### `src/lib/presence.ts`
- Manages the Supabase Realtime Presence channel
- Singleton class for channel management
- Handles joining/leaving presence channel

#### `src/hooks/usePresence.ts`
- React hook for real-time presence
- Provides `onlineUserIds`, `isOnline(userId)`, and connection status
- Automatically joins presence channel on mount

#### `src/hooks/useLastSeen.ts`
- Manages last-seen heartbeat functionality
- Updates `last_seen` every 5 minutes
- Handles visibility change, focus, and unload events
- Exports `touchLastSeen()` helper function

#### `src/components/UserChip.tsx`
- Reusable component for displaying user information with online status
- Shows avatar, name, and online/offline indicator
- Configurable size and tooltip options

### 3. Usage Examples

#### Basic Presence Hook Usage

```tsx
import { usePresence } from '../hooks/usePresence';

function MyComponent() {
  const { onlineUserIds, isOnline, isConnected } = usePresence();
  
  return (
    <div>
      <p>Connection status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <p>Online users: {onlineUserIds.size}</p>
      <p>User 123 is {isOnline('123') ? 'online' : 'offline'}</p>
    </div>
  );
}
```

#### Last-Seen Hook Usage

```tsx
import { useLastSeen } from '../hooks/useLastSeen';

function MyComponent() {
  const { touchLastSeen } = useLastSeen();
  
  // The hook automatically handles:
  // - Periodic updates every 5 minutes
  // - Updates on visibility change
  // - Updates on page focus
  // - Updates on page unload
  
  // Manual update if needed
  const handleManualUpdate = () => {
    touchLastSeen();
  };
  
  return <button onClick={handleManualUpdate}>Update Last Seen</button>;
}
```

#### UserChip Component Usage

```tsx
import { UserChip } from '../components/UserChip';

function UserList() {
  const { isOnline } = usePresence();
  
  return (
    <div>
      {users.map(user => (
        <UserChip
          key={user.id}
          user={user}
          isOnline={isOnline(user.id)}
          size="md"
          showTooltip={true}
        />
      ))}
    </div>
  );
}
```

## Implementation Details

### Presence Channel

- **Channel name**: `presence:online-users`
- **Payload structure**: `{ user_id, email, display_name }`
- **Deduplication**: Uses `user.id` as presence key to handle multiple tabs
- **Automatic cleanup**: Presence is removed when user disconnects

### Last-Seen Updates

- **Frequency**: Every 5 minutes when active
- **Events**: Also updates on tab visibility change, focus, and unload
- **Rate limiting**: Minimum 1 minute between updates to avoid excessive writes
- **Error handling**: Gracefully handles failed updates

### Performance Considerations

- **Zero-write presence**: Uses websockets, no database writes
- **Minimal last-seen writes**: Only current user writes, every 5 minutes max
- **Efficient updates**: Uses React hooks for minimal re-renders
- **Connection management**: Automatically reconnects on network issues

## Testing

### Manual Testing

1. **Open Users page in two browsers with different accounts**
   - Both should show each other as "Online" within seconds

2. **Close one browser**
   - Other side should update to "Last seen ~a few seconds ago" after presence drop

3. **Leave a user idle for 6-7 minutes**
   - `last_seen` should advance every 5 minutes
   - Users page should show updated relative time without reload

### Edge Cases Handled

- **Multiple tabs**: Presence key ensures one logical online state
- **Anonymous users**: Do not join presence or write last-seen
- **Network issues**: Automatic reconnection and presence sync
- **Time skew**: Uses client time for relative display (acceptable for this use case)

## Troubleshooting

### Common Issues

1. **Users not showing as online**
   - Check if Supabase Realtime is enabled
   - Verify presence channel subscription
   - Check browser console for connection errors

2. **Last-seen not updating**
   - Verify RLS policies are correct
   - Check if user is authenticated
   - Ensure `profiles` table has `last_seen` column

3. **Performance issues**
   - Presence updates are real-time (websocket)
   - Last-seen updates are throttled to 5 minutes
   - Check for excessive re-renders in components

### Debug Mode

Enable debug logging by checking browser console:
- Presence channel connection status
- Last-seen update attempts
- Error messages for failed operations

## Future Enhancements

- **Presence indicators**: Add typing indicators, away status
- **Activity tracking**: Track user actions beyond just presence
- **Offline notifications**: Notify when users go offline
- **Presence analytics**: Track user engagement patterns
