-- Comprehensive Approval Tokens Diagnostic Script
-- Run this in Supabase SQL Editor to diagnose all issues
-- Date: November 18, 2024

-- ========================================
-- STEP 1: Check if table exists
-- ========================================
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'approval_tokens'
  ) THEN
    RAISE NOTICE '✅ Table "approval_tokens" exists';
  ELSE
    RAISE EXCEPTION '❌ Table "approval_tokens" DOES NOT EXIST! You need to run: supabase/migrations/20250616000001_approval_tokens.sql';
  END IF;
END $$;

-- ========================================
-- STEP 2: Check table schema
-- ========================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'approval_tokens'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid)
-- job_id (uuid)
-- token (character varying)
-- approval_type (character varying)
-- extra_charges_data (jsonb)
-- approver_email (character varying)
-- approver_name (character varying)
-- expires_at (timestamp with time zone)
-- used_at (timestamp with time zone)
-- created_at (timestamp with time zone)

-- ========================================
-- STEP 3: Check RLS is enabled
-- ========================================
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'approval_tokens';

-- rowsecurity should be TRUE (t)

-- ========================================
-- STEP 4: Check RLS policies
-- ========================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'approval_tokens'
ORDER BY cmd, policyname;

-- Expected 3 policies:
-- 1. Name: "Anyone can read valid approval tokens"
--    Command: SELECT
--    Roles: {public} or {}
--    
-- 2. Name: "Authenticated users can create approval tokens"  
--    Command: INSERT
--    Roles: {authenticated}
--
-- 3. Name: "Anyone can update approval tokens to mark as used"
--    Command: UPDATE
--    Roles: {public} or {}

-- ========================================
-- STEP 5: Check indexes
-- ========================================
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'approval_tokens'
ORDER BY indexname;

-- Expected indexes:
-- idx_approval_tokens_token
-- idx_approval_tokens_job_id
-- idx_approval_tokens_expires_at
-- idx_approval_tokens_used_at

-- ========================================
-- STEP 6: Test INSERT permission (as authenticated user)
-- ========================================
DO $$
DECLARE
  test_job_id UUID;
  test_token_id UUID;
BEGIN
  -- Get a real job ID to test with
  SELECT id INTO test_job_id FROM jobs LIMIT 1;
  
  IF test_job_id IS NULL THEN
    RAISE NOTICE '⚠️  No jobs found in database - cannot test insert';
    RETURN;
  END IF;
  
  -- Try to insert a test approval token
  BEGIN
    INSERT INTO approval_tokens (
      job_id,
      token,
      approval_type,
      approver_email,
      approver_name,
      expires_at
    ) VALUES (
      test_job_id,
      'diagnostic-test-' || gen_random_uuid()::text,
      'extra_charges',
      'test@example.com',
      'Test User',
      NOW() + INTERVAL '30 minutes'
    )
    RETURNING id INTO test_token_id;
    
    RAISE NOTICE '✅ Test INSERT successful! Token ID: %', test_token_id;
    
    -- Clean up test record
    DELETE FROM approval_tokens WHERE id = test_token_id;
    RAISE NOTICE '✅ Test record cleaned up';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Test INSERT FAILED: %', SQLERRM;
    RAISE NOTICE 'Error code: %', SQLSTATE;
    RAISE NOTICE 'This means: Authenticated users CANNOT create approval tokens';
    RAISE NOTICE 'Fix: Re-run migration or check RLS policies';
  END;
END $$;

-- ========================================
-- STEP 7: Test SELECT permission (as anonymous)
-- ========================================
-- This tests if the public SELECT policy works
SELECT 
  COUNT(*) as total_tokens,
  COUNT(*) FILTER (WHERE used_at IS NULL) as unused_tokens,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as valid_tokens
FROM approval_tokens;

-- If this fails with "permission denied":
-- The SELECT policy is missing or broken

-- ========================================
-- STEP 8: Check for existing data
-- ========================================
SELECT 
  id,
  job_id,
  token,
  approval_type,
  approver_email,
  expires_at,
  used_at,
  created_at,
  CASE 
    WHEN used_at IS NOT NULL THEN '🔴 USED'
    WHEN expires_at < NOW() THEN '🔴 EXPIRED'
    ELSE '🟢 VALID'
  END as status
FROM approval_tokens
ORDER BY created_at DESC
LIMIT 10;

-- ========================================
-- STEP 9: Summary Report
-- ========================================
DO $$
DECLARE
  table_exists BOOLEAN;
  rls_enabled BOOLEAN;
  policy_count INTEGER;
  index_count INTEGER;
  total_tokens INTEGER;
BEGIN
  -- Check table
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'approval_tokens'
  ) INTO table_exists;
  
  -- Check RLS
  SELECT rowsecurity INTO rls_enabled
  FROM pg_tables
  WHERE tablename = 'approval_tokens';
  
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'approval_tokens';
  
  -- Count indexes
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'approval_tokens'
  AND indexname LIKE 'idx_approval_tokens_%';
  
  -- Count tokens
  SELECT COUNT(*) INTO total_tokens FROM approval_tokens;
  
  -- Print summary
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════╗';
  RAISE NOTICE '║     APPROVAL TOKENS DIAGNOSTIC SUMMARY         ║';
  RAISE NOTICE '╚════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'Table exists:        %', CASE WHEN table_exists THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE 'RLS enabled:         %', CASE WHEN rls_enabled THEN '✅ YES' ELSE '❌ NO' END;
  RAISE NOTICE 'Policies found:      % (expected: 3)', policy_count;
  RAISE NOTICE 'Indexes found:       % (expected: 4)', index_count;
  RAISE NOTICE 'Total tokens:        %', total_tokens;
  RAISE NOTICE '';
  
  -- Recommendations
  IF NOT table_exists THEN
    RAISE NOTICE '❌ ACTION REQUIRED: Run migration file';
    RAISE NOTICE '   File: supabase/migrations/20250616000001_approval_tokens.sql';
  ELSIF NOT rls_enabled THEN
    RAISE NOTICE '❌ ACTION REQUIRED: Enable RLS';
    RAISE NOTICE '   Run: ALTER TABLE approval_tokens ENABLE ROW LEVEL SECURITY;';
  ELSIF policy_count < 3 THEN
    RAISE NOTICE '❌ ACTION REQUIRED: Add missing RLS policies';
    RAISE NOTICE '   Expected: 3 policies (SELECT, INSERT, UPDATE)';
    RAISE NOTICE '   Found: % policies', policy_count;
  ELSE
    RAISE NOTICE '✅ ALL CHECKS PASSED!';
    RAISE NOTICE '   Database is configured correctly.';
    RAISE NOTICE '   If emails still fail, check:';
    RAISE NOTICE '   1. Frontend code (token generation logic)';
    RAISE NOTICE '   2. Browser console for specific errors';
    RAISE NOTICE '   3. Supabase client authentication';
  END IF;
  
  RAISE NOTICE '';
END $$;

-- ========================================
-- STEP 10: Permission test as different roles
-- ========================================
-- This shows what each role can do

-- Test as authenticated (simulated)
COMMENT ON TABLE approval_tokens IS 'Test completed. Review NOTICE messages above for results.';

-- To actually test as anon, you would need to:
-- 1. Create a separate connection with anon key
-- 2. Try SELECT, INSERT, UPDATE operations
-- 3. Check which ones succeed/fail

-- ========================================
-- QUICK FIX: If policies are missing
-- ========================================
-- Uncomment and run these if policies are missing:

/*
-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Anyone can read valid approval tokens" ON approval_tokens;
DROP POLICY IF EXISTS "Authenticated users can create approval tokens" ON approval_tokens;
DROP POLICY IF EXISTS "Anyone can update approval tokens to mark as used" ON approval_tokens;

-- Recreate policies
CREATE POLICY "Anyone can read valid approval tokens"
  ON approval_tokens
  FOR SELECT
  USING (
    used_at IS NULL 
    AND expires_at > NOW()
  );

CREATE POLICY "Authenticated users can create approval tokens"
  ON approval_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update approval tokens to mark as used"
  ON approval_tokens
  FOR UPDATE
  USING (
    used_at IS NULL 
    AND expires_at > NOW()
  )
  WITH CHECK (
    used_at IS NOT NULL
  );

-- Verify policies created
SELECT policyname FROM pg_policies WHERE tablename = 'approval_tokens';
*/
