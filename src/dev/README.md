# Dev Chat Test Harness

This directory contains a DEV-ONLY test harness for testing chat functionality without touching the database structure.

## Component: DevChatHarness

The `DevChatHarness.tsx` component provides a comprehensive testing interface for all chat features.

## How to Mount Temporarily

### Option 1: Add to App.tsx (Temporary)

Add this import and component to your `src/App.tsx`:

```tsx
import DevChatHarness from '@/dev/DevChatHarness';

// Add this somewhere in your App component's JSX:
{import.meta.env.DEV && <DevChatHarness />}
```

### Option 2: Add to a Route (Temporary)

Add a temporary route in your router configuration:

```tsx
import DevChatHarness from '@/dev/DevChatHarness';

// Add this route temporarily:
{
  path: '/dev',
  element: <DevChatHarness />
}
```

### Option 3: Add to MainLayout (Temporary)

Add to your main layout component:

```tsx
import DevChatHarness from '@/dev/DevChatHarness';

// Add this somewhere in your layout:
{import.meta.env.DEV && <DevChatHarness />}
```

## Features Tested

1. **Start DM** - Creates a direct message conversation with Sub10
2. **Send Test Message** - Posts a test message to the conversation
3. **Join Private Topic** - Joins the private chat topic for presence/typing
4. **Typing ON/OFF** - Toggles typing indicators
5. **Listen DB Inserts** - Listens to real-time database changes
6. **Mark Read** - Marks messages as read

## Test Users

- **Admin**: `design@thunderlightmedia.com` (ID: `e73e8b31-1c9c-4b56-97be-d85dd30ca26d`)
- **Subcontractor**: `sub10@jgapp.com` (ID: `fdb2a6f9-bb35-4dc9-a2c9-f9b87c1b1a46`)

## Acceptance Criteria

✅ **No database migrations are produced**
✅ **Start DM returns a CID when signed in as design@thunderlightmedia.com**
✅ **Send Test Message emits a new row in public.messages and notification to Sub10**
✅ **Join Private Topic shows presence events in the harness log**
✅ **Typing ON/OFF shows broadcast events in the harness log**

## Important Notes

- **DEV-ONLY**: This component only renders when `import.meta.env.DEV === true`
- **No DB Changes**: Uses existing Supabase objects and services
- **Real-time Testing**: Tests all real-time features including presence and typing
- **Comprehensive Logging**: All events are logged with timestamps and data

## Cleanup

Remember to remove the temporary mounting code before committing to production!
