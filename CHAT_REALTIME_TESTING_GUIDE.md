# Chat Real-Time Testing & Debugging Guide

## Overview
This guide will help you test and verify the real-time chat functionality, specifically:
1. Unread message counter updates
2. Green highlight for unread conversations
3. Conversation order updates (new messages jump to top)
4. Real-time message delivery

## Testing Setup

### Prerequisites
- Two browser windows/tabs or two different browsers
- Two different user accounts logged in
- Browser console open (F12) to view logs

### Test Scenario 1: Unread Counter Updates

**Steps:**
1. **Browser A (User 1)**: Log in and open the chat dropdown
2. **Browser B (User 2)**: Log in and send a message to User 1
3. **Browser A**: Observe the unread counter badge

**Expected Results:**
- ✅ Counter should increment immediately (within 1-2 seconds)
- ✅ Console should show: `[UnreadMessagesProvider] New message received:`
- ✅ Console should show: `[UnreadMessagesProvider] Unread count updated: X -> Y`

**If Not Working:**
- Check console for subscription status: `[UnreadMessagesProvider] Subscription status: SUBSCRIBED`
- Verify user is participant in conversation
- Check for errors in console

---

### Test Scenario 2: Green Highlight for Unread Conversations

**Steps:**
1. **Browser A (User 1)**: Open chat dropdown (don't open the chat)
2. **Browser B (User 2)**: Send a message to User 1
3. **Browser A**: Look at the conversation list in the dropdown

**Expected Results:**
- ✅ Conversation should have green left border
- ✅ Background should be light green (light mode) or dark green (dark mode)
- ✅ "New messages" text should appear below the name
- ✅ Console should show: `[UnreadMessagesProvider] Unread conversations: [...]`

**If Not Working:**
- Check if `unreadConversations` Set contains the conversation ID
- Verify the CSS classes are applied: `border-green-500 bg-green-50 dark:bg-green-900/10`
- Check if `hasUnread` variable is true in the component

---

### Test Scenario 3: Conversation Order Updates

**Steps:**
1. **Browser A (User 1)**: Open chat dropdown, observe current order
2. **Browser B (User 2)**: Send a message to a conversation that's NOT at the top
3. **Browser A**: Watch the conversation list

**Expected Results:**
- ✅ Conversation should immediately jump to the top of the list
- ✅ Console should show: `[ChatMenuEnhanced] New message received:`
- ✅ Console should show: `[ChatMenuEnhanced] Moving conversation to top: [conversation-id]`

**If Not Working:**
- Check console for: `[ChatMenuEnhanced] Messages channel status: SUBSCRIBED`
- Verify the conversation update logic is firing
- Check if user is participant (console shows: `[ChatMenuEnhanced] Message is for current user`)

---

### Test Scenario 4: Real-Time Message Delivery in Chat View

**Steps:**
1. **Browser A (User 1)**: Open a specific chat conversation
2. **Browser B (User 2)**: Send a message in the same conversation
3. **Browser A**: Observe the chat window

**Expected Results:**
- ✅ Message should appear immediately in the chat window
- ✅ Message should auto-mark as read
- ✅ Console should show message insertion

**If Not Working:**
- Check for channel subscription: `messages:[conversation-id]`
- Verify real-time subscription is active
- Check for duplicate prevention logic

---

## Console Log Reference

### Expected Logs (Success)

#### On Page Load:
```
[UnreadMessagesProvider] Initial unread count loaded: X messages across Y conversations
[ChatMenuEnhanced] Loading conversations for user: [user-id] Dropdown open: false
[ChatMenuEnhanced] Loaded conversations: X
[ChatMenuEnhanced] Setting up real-time subscriptions for user: [user-id]
[ChatMenuEnhanced] Conversations channel status: SUBSCRIBED
[ChatMenuEnhanced] Messages channel status: SUBSCRIBED
[UnreadMessagesProvider] Subscription status: SUBSCRIBED
```

#### On New Message (Recipient Side):
```
[UnreadMessagesProvider] New message received: {id: "...", conversation_id: "...", ...}
[UnreadMessagesProvider] User is participant, incrementing unread count
[UnreadMessagesProvider] Unread count updated: X -> Y
[UnreadMessagesProvider] Unread conversations: ["..."]
[ChatMenuEnhanced] New message received: {id: "...", conversation_id: "...", ...}
[ChatMenuEnhanced] Message is for current user, updating conversations
[ChatMenuEnhanced] Moving conversation to top: [conversation-id]
```

#### On Mark As Read:
```
Marking conversation as read: [conversation-id]
Marking X messages as read
Conversation marked as read, decremented count by X
```

### Problem Logs (Issues)

#### Real-time Not Connected:
```
[ChatMenuEnhanced] Conversations channel status: CHANNEL_ERROR
[UnreadMessagesProvider] Subscription status: CLOSED
```
**Fix:** Check Supabase connection, verify realtime is enabled on tables

#### User Not Participant:
```
[ChatMenuEnhanced] Message not for current user, ignoring
[UnreadMessagesProvider] User is not a participant, ignoring
```
**Fix:** Verify conversation participants array includes user ID

#### No Subscription:
```
(No logs about subscriptions)
```
**Fix:** Check if useEffect hooks are running, verify user?.id is defined

---

## Manual Verification Checklist

- [ ] Unread counter badge shows on bell icon when there are unread messages
- [ ] Unread counter increments immediately when new message arrives
- [ ] Unread counter decrements when marking conversation as read
- [ ] Conversations with unread messages have green left border
- [ ] Conversations with unread messages have green background tint
- [ ] "New messages" text appears for unread conversations
- [ ] New messages cause conversation to jump to top of list
- [ ] Conversation list updates in real-time without refresh
- [ ] Opening a conversation automatically marks it as read
- [ ] Messages appear immediately in open chat window
- [ ] No archive (X) button visible in dropdown or chat view
- [ ] Chat UI is vibrant and not faded in dark mode
- [ ] Console shows proper subscription status (SUBSCRIBED)

---

## Common Issues & Solutions

### Issue: Counter doesn't update
**Possible Causes:**
- Real-time subscription not connected
- User not included in conversation participants
- Filter on subscription not matching (`sender_id=neq.${user.id}`)

**Solutions:**
1. Check browser console for subscription status
2. Verify message_reads table exists and has proper RLS policies
3. Check Supabase realtime is enabled on messages table
4. Verify user ID is correct in filter

### Issue: Green highlight doesn't show
**Possible Causes:**
- `unreadConversations` Set not updated
- CSS classes not applied
- State not triggering re-render

**Solutions:**
1. Check console logs for unread conversations array
2. Verify `hasUnread` is true in component
3. Check React DevTools for `unreadConversations` state
4. Ensure component is re-rendering when state changes

### Issue: Conversation order doesn't update
**Possible Causes:**
- Message subscription not firing
- User not participant in conversation
- State update logic not executing

**Solutions:**
1. Check for message subscription logs
2. Verify participant check passes
3. Check `setAllConversations` is being called
4. Verify sorting logic runs after state update

### Issue: Messages don't appear in real-time
**Possible Causes:**
- Chat-specific channel not subscribed
- Duplicate prevention blocking message
- Message loading failed

**Solutions:**
1. Check for channel name: `messages:[conversation-id]`
2. Verify message ID is unique
3. Check for errors in message loading

---

## Database Verification

### Check message_reads table exists:
```sql
SELECT * FROM message_reads LIMIT 5;
```

### Check RLS policies:
```sql
SELECT * FROM pg_policies WHERE tablename = 'message_reads';
```

### Check realtime publication:
```sql
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

### Manually test unread count for a user:
```sql
-- Get all messages sent to user (not by user)
SELECT m.id, m.conversation_id, m.sender_id, m.created_at
FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE c.participants @> ARRAY['user-id-here']
  AND m.sender_id != 'user-id-here';

-- Get read messages
SELECT * FROM message_reads 
WHERE user_id = 'user-id-here';

-- Count unread (messages not in message_reads)
SELECT COUNT(*) FROM messages m
JOIN conversations c ON m.conversation_id = c.id
WHERE c.participants @> ARRAY['user-id-here']
  AND m.sender_id != 'user-id-here'
  AND NOT EXISTS (
    SELECT 1 FROM message_reads mr
    WHERE mr.message_id = m.id 
      AND mr.user_id = 'user-id-here'
  );
```

---

## Performance Monitoring

### Key Metrics:
- Time from message send to counter update: **< 2 seconds**
- Time from message send to UI update: **< 1 second**
- CPU usage during real-time updates: **< 5% spike**
- Memory usage: **Stable, no leaks**

### Monitoring Commands:
```javascript
// In browser console - Monitor subscription status
setInterval(() => {
  console.log('Subscription check');
}, 5000);

// Check state
console.log('Unread count:', window.__unreadCount);
console.log('Unread conversations:', window.__unreadConversations);
```

---

## Next Steps

After verifying basic functionality:

1. **Add Desktop Notifications** (optional)
   - Request notification permission
   - Show notification on new message
   - Play sound alert

2. **Add Typing Indicators** (optional)
   - Track when user is typing
   - Show "User is typing..." in chat

3. **Add Message Previews** (optional)
   - Show last message preview in conversation list
   - Truncate long messages

4. **Add Read Receipts UI** (optional)
   - Show checkmarks when message is read
   - Display "Seen by..." timestamps

5. **Optimize Performance**
   - Implement message pagination
   - Add virtual scrolling for long conversations
   - Optimize real-time subscription filters

---

## Support

If issues persist after following this guide:
1. Export browser console logs
2. Check Supabase dashboard for real-time events
3. Verify database schema matches expected structure
4. Test with fresh user accounts
5. Try incognito/private browsing mode
