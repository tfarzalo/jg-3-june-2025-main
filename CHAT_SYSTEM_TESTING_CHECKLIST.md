# Chat System Testing Checklist

## Pre-Testing Setup
- Ensure you have run the `fix_chat_system_comprehensive.sql` script in Supabase SQL Editor
- Verify that profiles table has `avatar_url` column
- Verify that `start_dm` and `can_chat_with` functions exist in the database

---

## Test Scenarios

### 1. Real-Time Messaging ✅

**Test A: Auto-Open Chat Window**
- [ ] Log in as User A
- [ ] Open another browser/incognito window and log in as User B
- [ ] From User B, send a message to User A
- [ ] Verify User A sees the chat window automatically open
- [ ] Verify the message appears immediately in the chat window

**Test B: Real-Time Message Delivery**
- [ ] Keep a chat window open between User A and User B
- [ ] Send messages back and forth
- [ ] Verify messages appear instantly without refresh
- [ ] Verify timestamps are correct

---

### 2. Green Blinking Notification 🟢

**Test A: Minimized Chat**
- [ ] User A has chat window open with User B
- [ ] Click minimize button on chat window
- [ ] From User B, send a message to User A
- [ ] Verify the chat tab in dock shows:
  - ✅ Green background color
  - ✅ Pulsing animation
  - ✅ Unread count badge (red circle with number)
  - ✅ Ring border around the tab

**Test B: Clear Unread on Open**
- [ ] With chat minimized and showing green notification
- [ ] Click on the green chat tab to un-minimize
- [ ] Verify green background disappears
- [ ] Verify unread count badge disappears
- [ ] Verify chat opens with messages visible

**Test C: Multiple Unread Messages**
- [ ] Minimize chat with User B
- [ ] Have User B send 3 messages
- [ ] Verify unread count shows "3"
- [ ] Un-minimize chat
- [ ] Verify count clears to 0

---

### 3. Role-Based Chat Restrictions 🔒

**Test A: Subcontractor Search Restrictions**
- [ ] Log in as a subcontractor user
- [ ] Click the chat icon to open New Chat Modal
- [ ] Type in the search box
- [ ] Verify ONLY admin and jg_management users appear in results
- [ ] Verify NO other subcontractors appear in search results
- [ ] Verify blue info notice appears: "As a subcontractor, you can only start chats with administrators and JG management."

**Test B: Admin Can Chat with Anyone**
- [ ] Log in as an admin user
- [ ] Open New Chat Modal
- [ ] Search for users
- [ ] Verify admin can see ALL user types in search (admin, jg_management, subcontractor)

**Test C: Backend Enforcement**
- [ ] Attempt to call start_dm function directly from Supabase (or via API)
- [ ] Try to create chat between two subcontractors
- [ ] Verify it fails with error: "Subcontractors cannot chat with other subcontractors"

---

### 4. Avatar Display 👤

**Test A: User with Avatar Image**
- [ ] Upload an avatar for a test user (if not already uploaded)
- [ ] Start a chat with this user
- [ ] Verify avatar image displays correctly in:
  - ✅ Chat window header
  - ✅ Chat dock tab
  - ✅ New Chat Modal search results

**Test B: User without Avatar (Initials Fallback)**
- [ ] Find or create a user without an avatar_url
- [ ] Start a chat with this user
- [ ] Verify initials display correctly (2 letters) in:
  - ✅ Chat window header
  - ✅ Chat dock tab
  - ✅ New Chat Modal search results
- [ ] Verify initials are uppercase
- [ ] For "John Doe" → should show "JD"
- [ ] For "Alice" → should show "AL"

**Test C: Avatar Loading Error**
- [ ] Manually edit database to set avatar_url to invalid URL
- [ ] Start chat with this user
- [ ] Verify initials appear as fallback (not broken image)

**Test D: Avatar in New Chat Modal**
- [ ] Open New Chat Modal
- [ ] Search for users
- [ ] Verify all user results show either:
  - Avatar image, OR
  - Initials in circular badge

---

### 5. Chat Window Functionality 💬

**Test A: Send and Receive Messages**
- [ ] Open chat between User A and User B
- [ ] Send message from User A
- [ ] Verify message appears in User A's window with:
  - ✅ Blue background (right side)
  - ✅ Timestamp
- [ ] Verify message appears in User B's window with:
  - ✅ Gray background (left side)
  - ✅ Timestamp

**Test B: Multiple Chat Windows**
- [ ] Open 3 different chats simultaneously
- [ ] Verify all 3 appear as tabs in the dock
- [ ] Send messages in different chats
- [ ] Verify correct unread counts on each tab
- [ ] Minimize and maximize different chats
- [ ] Verify state persists correctly

**Test C: Close and Reopen**
- [ ] Open a chat window
- [ ] Close it using the X button
- [ ] Send a new message from the other user
- [ ] Verify chat window auto-opens again

---

### 6. UI/UX Polish ✨

**Test A: Dark Mode**
- [ ] Switch to dark mode
- [ ] Verify all chat UI elements display correctly
- [ ] Verify green notification is visible in dark mode
- [ ] Verify avatars are visible in dark mode

**Test B: Long Names/Emails**
- [ ] Test with user that has very long name or email
- [ ] Verify text truncates with ellipsis (...)
- [ ] Verify layout doesn't break

**Test C: Scrolling**
- [ ] Send 20+ messages in a chat
- [ ] Verify messages scroll properly
- [ ] Verify auto-scroll to bottom on new message
- [ ] Verify scroll bar appears when needed

---

## Expected Results Summary

✅ **Real-Time Messaging**: Messages appear instantly, no page refresh needed
✅ **Green Blinking**: Clear visual indicator with pulsing animation and unread count
✅ **Role Restrictions**: Subcontractors can only chat with admin/jg_management
✅ **Avatar Display**: Images load correctly with proper fallback to initials
✅ **No Errors**: Check browser console for no JavaScript errors
✅ **Performance**: Chat opens/closes smoothly with no lag

---

## Common Issues to Watch For

1. **Console Errors**: Check browser DevTools console for any errors
2. **Subscription Issues**: Verify real-time subscriptions are active (check Network tab)
3. **Avatar URLs**: Ensure Supabase storage bucket "avatars" exists and is public
4. **Database Functions**: Ensure start_dm and can_chat_with functions exist
5. **RLS Policies**: Verify profiles and messages tables have proper RLS policies

---

## Rollback Plan (If Issues Found)

If critical issues are discovered, you can rollback using:
```bash
git revert 870de3d
git push origin main
```

Then investigate and fix issues before re-applying changes.

---

## Sign-Off

- [ ] All real-time messaging tests passed
- [ ] All green blinking notification tests passed
- [ ] All role restriction tests passed
- [ ] All avatar display tests passed
- [ ] No console errors observed
- [ ] Performance is acceptable
- [ ] Ready for production use

**Tested By**: _________________
**Date**: _________________
**Notes**: _________________
