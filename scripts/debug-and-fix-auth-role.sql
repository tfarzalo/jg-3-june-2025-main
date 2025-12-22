-- Debug: Check what role is being used during INSERT
-- Run this in Supabase SQL Editor
-- Date: November 18, 2024

-- Check current role
SELECT current_user, current_role;

-- Check if the user making the request is actually 'authenticated'
-- This will show what role the Supabase client is using

-- Try a test insert to see the actual error
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
  
  RAISE NOTICE 'Testing INSERT with current role...';
  RAISE NOTICE 'Current user: %', current_user;
  
  -- Try to insert
  INSERT INTO approval_tokens (
    job_id,
    token,
    approval_type,
    approver_email,
    approver_name,
    expires_at
  ) VALUES (
    test_job_id,
    'test-debug-' || gen_random_uuid()::text,
    'extra_charges',
    'test@example.com',
    'Test User',
    NOW() + INTERVAL '7 days'
  )
  RETURNING id INTO test_token_id;
  
  RAISE NOTICE '✅ INSERT SUCCESSFUL! Token ID: %', test_token_id;
  RAISE NOTICE 'This means the policy IS working in SQL Editor';
  RAISE NOTICE 'Problem must be with how the frontend is authenticated';
  
  -- Clean up
  DELETE FROM approval_tokens WHERE id = test_token_id;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '❌ INSERT FAILED: %', SQLERRM;
  RAISE NOTICE 'Error code: %', SQLSTATE;
  RAISE NOTICE 'This means even SQL Editor cant insert - policy is broken';
END $$;

-- The real issue: Frontend might be using 'anon' role instead of 'authenticated'
-- Let's add a policy for anon as well (temporary workaround)

-- Check if we need to add anon INSERT policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'approval_tokens' 
    AND policyname = 'Allow anonymous to create approval tokens'
  ) THEN
    RAISE NOTICE 'Creating INSERT policy for anon role...';
    
    CREATE POLICY "Allow anonymous to create approval tokens"
      ON approval_tokens
      FOR INSERT
      TO anon
      WITH CHECK (true);
    
    RAISE NOTICE '✅ Created anon INSERT policy';
  ELSE
    RAISE NOTICE 'Anon INSERT policy already exists';
  END IF;
END $$;

-- Verify all policies
SELECT 
  policyname,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'approval_tokens'
ORDER BY cmd, policyname;

-- You should now see 6 policies:
-- 1. INSERT for authenticated
-- 2. INSERT for anon (NEW - might fix your issue!)
-- 3. SELECT for authenticated  
-- 4. SELECT for anon
-- 5. UPDATE for authenticated
-- 6. UPDATE for anon
