-- Fix RLS Policy for approval_tokens
-- Run this in Supabase SQL Editor
-- Date: November 18, 2024

-- Step 1: Drop existing policies (in case they're wrong)
DROP POLICY IF EXISTS "Anyone can read valid approval tokens" ON approval_tokens;
DROP POLICY IF EXISTS "Authenticated users can create approval tokens" ON approval_tokens;
DROP POLICY IF EXISTS "Anyone can update approval tokens to mark as used" ON approval_tokens;

-- Step 2: Create correct policies

-- Policy 1: Allow authenticated users to INSERT (this is the critical one!)
CREATE POLICY "Authenticated users can create approval tokens"
  ON approval_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy 2: Allow anyone to SELECT valid tokens (for approval page)
CREATE POLICY "Anyone can read valid approval tokens"
  ON approval_tokens
  FOR SELECT
  TO public
  USING (
    used_at IS NULL 
    AND expires_at > NOW()
  );

-- Policy 3: Allow anyone to UPDATE to mark as used
CREATE POLICY "Anyone can update approval tokens to mark as used"
  ON approval_tokens
  FOR UPDATE
  TO public
  USING (
    used_at IS NULL 
    AND expires_at > NOW()
  )
  WITH CHECK (
    used_at IS NOT NULL
  );

-- Step 3: Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'approval_tokens'
ORDER BY cmd, policyname;

-- Expected output: 3 policies
-- 1. INSERT policy for 'authenticated' role
-- 2. SELECT policy for 'public' role  
-- 3. UPDATE policy for 'public' role

-- Step 4: Test INSERT permission
DO $$
DECLARE
  test_job_id UUID;
  test_token_id UUID;
BEGIN
  -- Get a real job ID
  SELECT id INTO test_job_id FROM jobs LIMIT 1;
  
  IF test_job_id IS NULL THEN
    RAISE NOTICE '⚠️  No jobs found - cannot test';
    RETURN;
  END IF;
  
  -- Try to insert as authenticated user would
  INSERT INTO approval_tokens (
    job_id,
    token,
    approval_type,
    approver_email,
    approver_name,
    expires_at
  ) VALUES (
    test_job_id,
    'test-fix-' || gen_random_uuid()::text,
    'extra_charges',
    'test@example.com',
    'Test User',
    NOW() + INTERVAL '7 days'
  )
  RETURNING id INTO test_token_id;
  
  RAISE NOTICE '✅ INSERT SUCCESSFUL! Token ID: %', test_token_id;
  
  -- Clean up
  DELETE FROM approval_tokens WHERE id = test_token_id;
  RAISE NOTICE '✅ Cleanup complete';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ INSERT FAILED: %', SQLERRM;
  RAISE NOTICE 'Error code: %', SQLSTATE;
END $$;

-- If you see "✅ INSERT SUCCESSFUL!" then the policy is fixed!
-- If you see "❌ INSERT FAILED" then there's still a problem
