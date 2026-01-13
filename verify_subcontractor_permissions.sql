-- ============================================================================
-- SUBCONTRACTOR PERMISSIONS VERIFICATION SCRIPT
-- ============================================================================
-- Run this script to check if subcontractors have proper permissions
-- to upload files and create work orders
--
-- Date: November 11, 2025
-- Related Doc: SUBCONTRACTOR_WORK_ORDER_ANALYSIS_AND_ROADMAP.md
-- ============================================================================

\echo '=========================================='
\echo 'CHECKING SUBCONTRACTOR FILE PERMISSIONS'
\echo '=========================================='
\echo ''

-- 1. Check RLS policies on files table
\echo '1. FILES TABLE RLS POLICIES:'
\echo '------------------------------------------'
SELECT 
  policyname,
  cmd,
  permissive,
  CASE 
    WHEN policyname ILIKE '%subcontractor%' THEN '✓ Subcontractor-specific'
    WHEN policyname ILIKE '%authenticated%' THEN '✓ All authenticated users'
    ELSE '⚠ Check manually'
  END as relevance
FROM pg_policies 
WHERE tablename = 'files'
ORDER BY cmd, policyname;

\echo ''
\echo '2. STORAGE.OBJECTS POLICIES:'
\echo '------------------------------------------'
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual IS NOT NULL THEN LEFT(qual::text, 50) || '...'
    ELSE 'No USING clause'
  END as using_clause_preview,
  CASE 
    WHEN with_check IS NOT NULL THEN LEFT(with_check::text, 50) || '...'
    ELSE 'No WITH CHECK clause'
  END as with_check_preview
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY cmd, policyname;

\echo ''
\echo '3. CHECKING FOR HELPER FUNCTIONS:'
\echo '------------------------------------------'
SELECT 
  routine_name,
  routine_type,
  CASE 
    WHEN routine_name ILIKE '%subcontractor%' THEN '✓ Subcontractor-related'
    WHEN routine_name ILIKE '%upload%' THEN '✓ Upload-related'
    WHEN routine_name ILIKE '%file%' THEN '✓ File-related'
    ELSE '- General function'
  END as relevance
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name ILIKE '%subcontractor%' 
    OR routine_name ILIKE '%upload%'
    OR routine_name ILIKE '%file%'
  )
ORDER BY routine_name;

\echo ''
\echo '4. CHECKING FUNCTION PERMISSIONS:'
\echo '------------------------------------------'
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  CASE 
    WHEN has_function_privilege('authenticated', oid, 'EXECUTE') THEN '✓ Executable by authenticated'
    ELSE '✗ NOT executable by authenticated'
  END as authenticated_access
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND (
    proname ILIKE '%upload%'
    OR proname ILIKE '%folder%'
    OR proname = 'is_subcontractor'
  )
ORDER BY proname;

\echo ''
\echo '5. CHECKING STORAGE BUCKETS:'
\echo '------------------------------------------'
SELECT 
  id as bucket_id,
  name as bucket_name,
  public as is_public,
  CASE 
    WHEN public THEN '✓ Public bucket - files accessible via URL'
    ELSE '✗ Private bucket - requires auth'
  END as access_type
FROM storage.buckets
WHERE id IN ('files', 'work_orders', 'avatars')
ORDER BY id;

\echo ''
\echo '6. SAMPLE RLS POLICY DETAILS (files table):'
\echo '------------------------------------------'
SELECT 
  policyname,
  cmd,
  LEFT(qual::text, 100) as using_clause,
  LEFT(with_check::text, 100) as with_check_clause
FROM pg_policies 
WHERE tablename = 'files' 
  AND (policyname ILIKE '%subcontractor%' OR policyname ILIKE '%authenticated%')
ORDER BY cmd, policyname;

\echo ''
\echo '=========================================='
\echo 'ANALYSIS SUMMARY'
\echo '=========================================='
\echo ''
\echo 'Next Steps:'
\echo '1. Review the policies above'
\echo '2. Ensure there are policies allowing:'
\echo '   - INSERT for authenticated users or subcontractors'
\echo '   - SELECT for authenticated users or subcontractors'
\echo '   - UPDATE for file owners'
\echo '3. Check storage.objects policies allow:'
\echo '   - INSERT to bucket_id = ''files'''
\echo '   - SELECT from bucket_id = ''files'''
\echo '4. Verify helper functions are executable by authenticated role'
\echo ''
\echo 'If any checks fail, run: fix_subcontractor_file_permissions.sql'
\echo ''

-- Additional diagnostic queries
\echo '7. TESTING SUBCONTRACTOR DETECTION FUNCTION:'
\echo '------------------------------------------'
\echo 'Testing if is_subcontractor() function exists and works...'
\echo ''

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'is_subcontractor' 
    AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE NOTICE '✓ is_subcontractor() function EXISTS';
  ELSE
    RAISE WARNING '✗ is_subcontractor() function DOES NOT EXIST - this may cause RLS policy failures!';
  END IF;
END $$;

\echo ''
\echo '8. CHECKING FOR COMMON ISSUES:'
\echo '------------------------------------------'

-- Check for conflicting policies
WITH policy_conflicts AS (
  SELECT 
    tablename,
    cmd,
    COUNT(*) as policy_count,
    CASE 
      WHEN COUNT(*) > 3 THEN '⚠ Many policies - potential conflicts'
      ELSE '✓ Normal policy count'
    END as status
  FROM pg_policies
  WHERE tablename IN ('files', 'work_orders', 'jobs')
  GROUP BY tablename, cmd
)
SELECT * FROM policy_conflicts
WHERE policy_count > 3
ORDER BY tablename, cmd;

\echo ''
\echo 'Verification complete!'
\echo ''
\echo 'Save this output and review with the team.'
\echo 'If issues found, apply fixes from fix_subcontractor_file_permissions.sql'
\echo ''
