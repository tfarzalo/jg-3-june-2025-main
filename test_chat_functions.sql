-- Test script to verify chat functions are working
-- Run this after applying the complete_chat_and_upload_fix.sql

-- Test 1: Check if start_dm function exists
SELECT 'Testing start_dm function existence...' as test;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'start_dm' AND routine_schema = 'public';

-- Test 2: Check if get_upload_folder function exists
SELECT 'Testing get_upload_folder function existence...' as test;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'get_upload_folder' AND routine_schema = 'public';

-- Test 3: Check if can_chat_with function exists
SELECT 'Testing can_chat_with function existence...' as test;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'can_chat_with' AND routine_schema = 'public';

-- Test 4: Check if post_message function exists
SELECT 'Testing post_message function existence...' as test;
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'post_message' AND routine_schema = 'public';

-- Test 5: Check if conversations table has subject column
SELECT 'Testing conversations table structure...' as test;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'conversations' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test 6: Check if chat tables exist
SELECT 'Testing chat tables existence...' as test;
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_name IN ('conversations', 'messages', 'message_reads') 
AND table_schema = 'public';

-- Test 7: Check RLS policies
SELECT 'Testing RLS policies...' as test;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('conversations', 'messages', 'message_reads')
ORDER BY tablename, policyname;

-- Test 8: Check function permissions
SELECT 'Testing function permissions...' as test;
SELECT 
    p.proname as function_name,
    p.proargnames as argument_names,
    r.rolname as granted_to
FROM pg_proc p
JOIN pg_depend d ON d.objid = p.oid
JOIN pg_roles r ON r.oid = d.refobjid
WHERE p.proname IN ('start_dm', 'get_upload_folder', 'can_chat_with', 'post_message')
AND d.deptype = 'a'
ORDER BY p.proname, r.rolname;
