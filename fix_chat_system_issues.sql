-- Chat System Diagnostic and Fix Script
-- Run this in Supabase SQL Editor to diagnose and fix common chat issues

-- ============================================================================
-- STEP 1: DIAGNOSTIC QUERIES
-- ============================================================================

-- Check if conversations table exists and has data
DO $$
BEGIN
  RAISE NOTICE '=== CHECKING CONVERSATIONS TABLE ===';
  RAISE NOTICE 'Total conversations: %', (SELECT COUNT(*) FROM conversations);
  RAISE NOTICE 'Active conversations: %', (SELECT COUNT(*) FROM conversations WHERE deleted_at IS NULL);
  RAISE NOTICE 'Soft-deleted conversations: %', (SELECT COUNT(*) FROM conversations WHERE deleted_at IS NOT NULL);
  RAISE NOTICE 'Archived conversations: %', (SELECT COUNT(*) FROM conversations WHERE archived = TRUE);
END $$;

-- Check messages table
DO $$
BEGIN
  RAISE NOTICE '=== CHECKING MESSAGES TABLE ===';
  RAISE NOTICE 'Total messages: %', (SELECT COUNT(*) FROM messages);
END $$;

-- Check if RLS is enabled
DO $$
BEGIN
  RAISE NOTICE '=== CHECKING RLS STATUS ===';
  RAISE NOTICE 'Conversations RLS enabled: %', (
    SELECT rowsecurity FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'conversations'
  );
  RAISE NOTICE 'Messages RLS enabled: %', (
    SELECT rowsecurity FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'messages'
  );
END $$;

-- List all policies
SELECT 
  '=== CONVERSATIONS POLICIES ===' as info,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'conversations';

SELECT 
  '=== MESSAGES POLICIES ===' as info,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'messages';

-- ============================================================================
-- STEP 2: FIX RLS POLICIES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view conversations they're part of" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete their conversations" ON conversations;

-- Recreate conversations policies with proper permissions
CREATE POLICY "Users can view conversations they're part of"
ON conversations FOR SELECT
TO authenticated
USING (auth.uid() = ANY(participants) AND deleted_at IS NULL);

CREATE POLICY "Users can create conversations"
ON conversations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = ANY(participants));

CREATE POLICY "Users can update conversations"
ON conversations FOR UPDATE
TO authenticated
USING (auth.uid() = ANY(participants))
WITH CHECK (auth.uid() = ANY(participants));

CREATE POLICY "Users can delete conversations"
ON conversations FOR DELETE
TO authenticated
USING (auth.uid() = ANY(participants));

-- Drop and recreate messages policies
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

CREATE POLICY "Users can view messages in their conversations"
ON messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND auth.uid() = ANY(conversations.participants)
    AND conversations.deleted_at IS NULL
  )
);

CREATE POLICY "Users can create messages in their conversations"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND auth.uid() = ANY(conversations.participants)
    AND conversations.deleted_at IS NULL
  )
  AND auth.uid() = sender_id
);

CREATE POLICY "Users can update their own messages"
ON messages FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages"
ON messages FOR DELETE
TO authenticated
USING (auth.uid() = sender_id);

-- ============================================================================
-- STEP 3: ENSURE FUNCTIONS HAVE PROPER PERMISSIONS
-- ============================================================================

-- Grant execute permissions on chat functions
GRANT EXECUTE ON FUNCTION get_user_conversations(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_deleted_conversations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION restore_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION permanently_delete_conversation(UUID) TO authenticated;

-- ============================================================================
-- STEP 4: OPTIONAL - RESTORE SOFT-DELETED CONVERSATIONS
-- ============================================================================

-- Uncomment the following if you want to restore all soft-deleted conversations
-- UPDATE conversations 
-- SET deleted_at = NULL, deleted_by = NULL 
-- WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- STEP 5: VERIFICATION QUERIES
-- ============================================================================

-- Test get_user_conversations function (replace with actual user ID)
-- SELECT * FROM get_user_conversations('YOUR_USER_ID_HERE', false);

-- View sample conversations
SELECT 
  id,
  participants,
  type,
  subject,
  archived,
  deleted_at IS NOT NULL as is_deleted,
  created_at
FROM conversations
ORDER BY created_at DESC
LIMIT 10;

-- View sample messages
SELECT 
  m.id,
  m.conversation_id,
  m.sender_id,
  m.body,
  m.created_at,
  p.full_name as sender_name
FROM messages m
LEFT JOIN profiles p ON p.id = m.sender_id
ORDER BY m.created_at DESC
LIMIT 10;

-- Count conversations per user
SELECT 
  p.full_name,
  p.email,
  COUNT(DISTINCT c.id) as conversation_count
FROM profiles p
LEFT JOIN conversations c ON p.id = ANY(c.participants)
WHERE c.deleted_at IS NULL OR c.deleted_at IS NOT NULL
GROUP BY p.id, p.full_name, p.email
ORDER BY conversation_count DESC;

-- ============================================================================
-- STEP 6: CREATE TEST DATA (OPTIONAL)
-- ============================================================================

-- Uncomment to create test conversations between first two users in system
/*
DO $$
DECLARE
  user1_id UUID;
  user2_id UUID;
  conv_id UUID;
BEGIN
  -- Get first two users
  SELECT id INTO user1_id FROM profiles ORDER BY created_at LIMIT 1;
  SELECT id INTO user2_id FROM profiles ORDER BY created_at LIMIT 1 OFFSET 1;
  
  IF user1_id IS NOT NULL AND user2_id IS NOT NULL THEN
    -- Create test conversation
    INSERT INTO conversations (participants, type, subject)
    VALUES (
      ARRAY[user1_id, user2_id],
      'direct',
      'Test Conversation'
    )
    RETURNING id INTO conv_id;
    
    -- Add test message
    INSERT INTO messages (conversation_id, sender_id, body)
    VALUES (
      conv_id,
      user1_id,
      'This is a test message to verify the chat system is working.'
    );
    
    RAISE NOTICE 'Created test conversation with ID: %', conv_id;
  ELSE
    RAISE NOTICE 'Not enough users to create test conversation';
  END IF;
END $$;
*/

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== CHAT SYSTEM FIX COMPLETE ===';
  RAISE NOTICE 'Please verify:';
  RAISE NOTICE '1. RLS policies are properly set';
  RAISE NOTICE '2. Functions have execute permissions';
  RAISE NOTICE '3. Test the get_user_conversations function with your user ID';
  RAISE NOTICE '4. Check if conversations load in the application';
END $$;
