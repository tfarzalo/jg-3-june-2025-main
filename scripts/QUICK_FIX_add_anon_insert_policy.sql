-- QUICK FIX: Add INSERT policy for 'anon' role
-- Your app might be using anon key instead of authenticated session
-- Run this in Supabase SQL Editor

-- Add INSERT policy for anon role (in addition to authenticated)
DROP POLICY IF EXISTS "Allow anonymous to create approval tokens" ON approval_tokens;

CREATE POLICY "Allow anonymous to create approval tokens"
  ON approval_tokens
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Verify both policies exist
SELECT 
  policyname,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'approval_tokens' 
AND cmd = 'INSERT'
ORDER BY policyname;

-- Expected output: 2 policies
-- 1. "Allow anonymous to create approval tokens" - roles: {anon}
-- 2. "Authenticated users can create approval tokens" - roles: {authenticated}
