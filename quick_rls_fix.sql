-- Quick Fix: Temporarily disable RLS on profiles table
-- This will allow the app to work while we fix the policy issues

-- Disable RLS temporarily
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Test if the table is now accessible
SELECT COUNT(*) FROM profiles LIMIT 1;

-- Check if we can query the specific user
SELECT id, email, full_name, role FROM profiles WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- If successful, the app should now work
-- We can then re-enable RLS with proper policies later
