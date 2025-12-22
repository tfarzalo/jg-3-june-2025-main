-- Chat Real-Time Verification Script
-- Run this in your Supabase SQL Editor to verify the setup

-- ============================================
-- 1. Verify message_reads table exists
-- ============================================
SELECT 
  'message_reads table' as check_name,
  CASE WHEN EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'message_reads'
  ) THEN 'PASS ✓' ELSE 'FAIL ✗' END as status;

-- ============================================
-- 2. Check message_reads table structure
-- ============================================
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'message_reads'
ORDER BY ordinal_position;

-- ============================================
-- 3. Verify RLS is enabled on key tables
-- ============================================
SELECT 
  tablename,
  CASE WHEN rowsecurity THEN 'ENABLED ✓' ELSE 'DISABLED ✗' END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('messages', 'conversations', 'message_reads')
ORDER BY tablename;

-- ============================================
-- 4. Check RLS policies for message_reads
-- ============================================
SELECT 
  policyname,
  cmd as operation,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'message_reads';

-- ============================================
-- 5. Verify realtime publication
-- ============================================
SELECT 
  tablename,
  CASE 
    WHEN tablename IN (
      SELECT tablename 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime'
    ) THEN 'ENABLED ✓' 
    ELSE 'DISABLED ✗' 
  END as realtime_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('messages', 'conversations', 'message_reads')
ORDER BY tablename;

-- ============================================
-- 6. Check indexes on message_reads
-- ============================================
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'message_reads';

-- ============================================
-- 7. Sample data check - message_reads
-- ============================================
SELECT 
  COUNT(*) as total_read_receipts,
  COUNT(DISTINCT user_id) as users_with_reads,
  COUNT(DISTINCT conversation_id) as conversations_with_reads
FROM message_reads;

-- ============================================
-- 8. Check conversations structure
-- ============================================
SELECT 
  COUNT(*) as total_conversations,
  COUNT(CASE WHEN archived = true THEN 1 END) as archived_count,
  COUNT(CASE WHEN archived IS NULL OR archived = false THEN 1 END) as active_count
FROM conversations;

-- ============================================
-- 9. Sample unread count for a specific user
-- Replace 'YOUR_USER_ID' with actual user ID
-- ============================================
-- Uncomment and replace with actual user ID:
/*
WITH user_messages AS (
  SELECT m.id, m.conversation_id, m.sender_id, m.created_at
  FROM messages m
  JOIN conversations c ON m.conversation_id = c.id
  WHERE c.participants @> ARRAY['YOUR_USER_ID']
    AND m.sender_id != 'YOUR_USER_ID'
    AND (c.archived IS NULL OR c.archived = false)
),
read_messages AS (
  SELECT message_id
  FROM message_reads
  WHERE user_id = 'YOUR_USER_ID'
)
SELECT 
  COUNT(*) as total_messages_from_others,
  COUNT(r.message_id) as read_messages,
  COUNT(*) - COUNT(r.message_id) as unread_messages
FROM user_messages um
LEFT JOIN read_messages r ON um.id = r.message_id;
*/

-- ============================================
-- 10. Verify permissions on tables
-- ============================================
SELECT 
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'authenticated'
  AND table_schema = 'public'
  AND table_name IN ('messages', 'conversations', 'message_reads')
ORDER BY table_name, privilege_type;

-- ============================================
-- 11. Check for any foreign key constraints
-- ============================================
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'message_reads';

-- ============================================
-- 12. Test query performance
-- ============================================
EXPLAIN ANALYZE
SELECT COUNT(*) FROM message_reads
WHERE conversation_id = 'test-id' AND user_id = 'test-user-id';

-- ============================================
-- 13. Recent activity check
-- ============================================
SELECT 
  'Messages' as table_name,
  COUNT(*) as total_rows,
  MAX(created_at) as last_activity
FROM messages
UNION ALL
SELECT 
  'Message Reads',
  COUNT(*),
  MAX(read_at)
FROM message_reads
UNION ALL
SELECT 
  'Conversations',
  COUNT(*),
  MAX(updated_at)
FROM conversations;

-- ============================================
-- Expected Results Summary
-- ============================================
/*
All checks should show:
1. ✓ message_reads table exists
2. ✓ Columns: id, conversation_id, message_id, user_id, read_at
3. ✓ RLS enabled on all three tables
4. ✓ At least 2 policies on message_reads (SELECT and INSERT)
5. ✓ All three tables in realtime publication
6. ✓ Index on (conversation_id, user_id)
7. ✓ authenticated role has ALL privileges
8. ✓ Foreign keys to conversations and messages

If any check fails, review the database setup scripts:
- chat_database_setup.sql
- fix_chat_functions_complete.sql
*/
