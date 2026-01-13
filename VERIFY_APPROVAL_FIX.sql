-- =====================================================
-- VERIFY APPROVAL SYSTEM FIX INSTALLATION
-- =====================================================
-- Run this to verify everything is working correctly
-- =====================================================

-- 1. Check system_logs table exists
SELECT 
  'system_logs table' as check_name,
  CASE 
    WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'system_logs')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status;

-- 2. Check indexes created
SELECT 
  'idx_approval_tokens_unused' as index_name,
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'idx_approval_tokens_unused')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
UNION ALL
SELECT 
  'idx_system_logs_level_created' as index_name,
  CASE 
    WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'idx_system_logs_level_created')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status;

-- 3. Check function exists and has correct signature
SELECT 
  'process_approval_token function' as check_name,
  CASE 
    WHEN EXISTS(
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'process_approval_token'
        AND routine_type = 'FUNCTION'
    )
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status;

-- 4. Check function permissions for anonymous users
SELECT 
  'anon execute permission' as check_name,
  CASE 
    WHEN has_function_privilege('anon', 'process_approval_token(varchar)', 'execute')
    THEN '✅ GRANTED'
    ELSE '❌ NOT GRANTED'
  END as status;

-- 5. Check RLS policies on system_logs
SELECT 
  schemaname,
  tablename,
  policyname,
  '✅ CONFIGURED' as status
FROM pg_policies 
WHERE tablename = 'system_logs';

-- 6. Show function details
SELECT 
  routine_name as function_name,
  routine_type as type,
  security_type as security,
  '✅ Details' as status
FROM information_schema.routines 
WHERE routine_name = 'process_approval_token';

-- 7. Test that system_logs is empty (no errors yet)
SELECT 
  'system_logs records' as check_name,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ EMPTY (Good - no errors yet)'
    ELSE '⚠️ Has entries (check them)'
  END as status
FROM system_logs;

-- 8. Summary
SELECT 
  '========================================' as summary,
  'INSTALLATION VERIFICATION COMPLETE' as status
UNION ALL
SELECT 
  'All checks should show ✅' as summary,
  'If any show ❌, review the migration' as status;
