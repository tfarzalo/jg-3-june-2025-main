-- Chat Badge Debug Script
-- Run this in Supabase SQL Editor to diagnose unread message badge issues
-- Replace the placeholder values with your actual data

-- ============================================================================
-- STEP 1: Get your user ID
-- ============================================================================
SELECT 
  id,
  email,
  full_name,
  '👤 This is your user ID - copy it for the next queries' as note
FROM profiles
WHERE email = 'YOUR_EMAIL@EXAMPLE.COM'; -- Replace with your email

-- ============================================================================
-- STEP 2: Check your conversations and unread counts
-- ============================================================================
-- Replace 'YOUR_USER_ID' with the ID from Step 1
WITH user_conversations AS (
  SELECT 
    c.id as conversation_id,
    c.participants,
    c.updated_at,
    c.archived,
    -- Count total messages from others
    (SELECT COUNT(*) 
     FROM messages m 
     WHERE m.conversation_id = c.id 
       AND m.sender_id != 'YOUR_USER_ID') as messages_from_others,
    -- Count messages you've read
    (SELECT COUNT(*) 
     FROM message_reads mr 
     WHERE mr.conversation_id = c.id 
       AND mr.user_id = 'YOUR_USER_ID') as messages_read,
    -- Calculate unread
    (SELECT COUNT(*) 
     FROM messages m 
     LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.user_id = 'YOUR_USER_ID'
     WHERE m.conversation_id = c.id 
       AND m.sender_id != 'YOUR_USER_ID'
       AND mr.id IS NULL) as unread_count,
    -- Get other participant's name
    (SELECT p.full_name 
     FROM profiles p 
     WHERE p.id = (SELECT unnest(c.participants) LIMIT 1 OFFSET 
       (CASE WHEN c.participants[1] = 'YOUR_USER_ID' THEN 1 ELSE 0 END))) as other_participant
  FROM conversations c
  WHERE 'YOUR_USER_ID' = ANY(c.participants)
)
SELECT 
  *,
  CASE 
    WHEN unread_count > 0 THEN '🔴 HAS UNREAD'
    ELSE '✅ ALL READ'
  END as status
FROM user_conversations
ORDER BY unread_count DESC, updated_at DESC;

-- ============================================================================
-- STEP 3: Detailed view of a specific conversation
-- ============================================================================
-- Replace 'YOUR_USER_ID' and 'CONVERSATION_ID' 
SELECT 
  m.id as message_id,
  p.full_name as sender_name,
  LEFT(m.body, 50) || '...' as message_preview,
  m.created_at,
  CASE 
    WHEN m.sender_id = 'YOUR_USER_ID' THEN '📤 SENT BY YOU'
    WHEN mr.id IS NOT NULL THEN '✅ READ'
    ELSE '🔴 UNREAD'
  END as status,
  mr.read_at
FROM messages m
LEFT JOIN profiles p ON p.id = m.sender_id
LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.user_id = 'YOUR_USER_ID'
WHERE m.conversation_id = 'CONVERSATION_ID'
ORDER BY m.created_at DESC
LIMIT 20;

-- ============================================================================
-- STEP 4: Check for duplicate read receipts (shouldn't exist)
-- ============================================================================
SELECT 
  conversation_id,
  message_id,
  user_id,
  COUNT(*) as duplicate_count,
  '❌ PROBLEM: Duplicates found!' as issue
FROM message_reads
GROUP BY conversation_id, message_id, user_id
HAVING COUNT(*) > 1;

-- If this returns rows, there's a data integrity issue

-- ============================================================================
-- STEP 5: Check for orphaned read receipts (shouldn't exist)
-- ============================================================================
SELECT 
  mr.id,
  mr.message_id,
  mr.conversation_id,
  '❌ PROBLEM: Read receipt for non-existent message!' as issue
FROM message_reads mr
LEFT JOIN messages m ON m.id = mr.message_id
WHERE m.id IS NULL
LIMIT 10;

-- If this returns rows, there's a data integrity issue

-- ============================================================================
-- STEP 6: Total unread count across all conversations
-- ============================================================================
-- This should match the badge number
SELECT 
  COUNT(*) as total_unread_messages,
  COUNT(DISTINCT m.conversation_id) as unread_conversations,
  '📊 This should match your badge count' as note
FROM messages m
LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.user_id = 'YOUR_USER_ID'
LEFT JOIN conversations c ON c.id = m.conversation_id
WHERE m.sender_id != 'YOUR_USER_ID'
  AND mr.id IS NULL
  AND 'YOUR_USER_ID' = ANY(c.participants)
  AND (c.archived IS NULL OR c.archived = false);

-- ============================================================================
-- STEP 7: Check RLS policies (ensure you can read/write)
-- ============================================================================
-- This checks if you can see your own read receipts
SELECT COUNT(*) as your_read_receipts
FROM message_reads
WHERE user_id = 'YOUR_USER_ID';

-- If this returns 0 but you've viewed messages, there's an RLS issue

-- ============================================================================
-- STEP 8: Test inserting a read receipt manually
-- ============================================================================
-- UNCOMMENT AND RUN THIS ONLY IF TESTING
-- Replace with actual IDs from Step 3 where you see an UNREAD message

/*
BEGIN;

INSERT INTO message_reads (conversation_id, message_id, user_id, read_at)
VALUES (
  'CONVERSATION_ID',
  'MESSAGE_ID',
  'YOUR_USER_ID',
  NOW()
);

-- Check if it worked
SELECT * FROM message_reads
WHERE conversation_id = 'CONVERSATION_ID'
  AND message_id = 'MESSAGE_ID'
  AND user_id = 'YOUR_USER_ID';

ROLLBACK; -- Or COMMIT if you want to keep it
*/

-- ============================================================================
-- STEP 9: Fix - Mark all messages in a conversation as read
-- ============================================================================
-- UNCOMMENT AND RUN THIS ONLY IF YOU WANT TO MANUALLY FIX
-- Replace 'YOUR_USER_ID' and 'CONVERSATION_ID'

/*
INSERT INTO message_reads (conversation_id, message_id, user_id, read_at)
SELECT 
  m.conversation_id,
  m.id,
  'YOUR_USER_ID',
  NOW()
FROM messages m
WHERE m.conversation_id = 'CONVERSATION_ID'
  AND m.sender_id != 'YOUR_USER_ID'
  AND NOT EXISTS (
    SELECT 1 FROM message_reads mr 
    WHERE mr.message_id = m.id 
      AND mr.user_id = 'YOUR_USER_ID'
  );

-- Verify
SELECT COUNT(*) as newly_marked_read
FROM message_reads
WHERE conversation_id = 'CONVERSATION_ID'
  AND user_id = 'YOUR_USER_ID'
  AND read_at > NOW() - INTERVAL '1 minute';
*/

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- After running these queries, you should be able to identify:
-- 1. Your total unread count (Step 6)
-- 2. Which conversations have unread messages (Step 2)
-- 3. Specific unread messages (Step 3)
-- 4. Any data integrity issues (Steps 4, 5)
-- 5. Whether RLS policies are working (Step 7)

-- If unread count in Step 6 is 0 but your badge still shows a number,
-- the issue is in the frontend React state not syncing with the database.

-- If unread count in Step 6 matches your badge but viewing messages doesn't
-- clear it, the markAsRead function isn't creating read receipts properly.
