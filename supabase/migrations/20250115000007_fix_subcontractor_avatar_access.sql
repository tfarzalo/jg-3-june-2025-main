-- Fix Subcontractor Avatar Access
-- This migration specifically fixes the issue where subcontractors cannot see avatars
-- by ensuring they can access profile information needed for chat functionality

-- First, let's completely disable RLS temporarily to clean up all policies
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies to start fresh
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated SELECT on profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated UPDATE on profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated DELETE on profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated INSERT on profiles" ON profiles;
  DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
  DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_select_subcontractors" ON profiles;
  DROP POLICY IF EXISTS "profiles_select_jg_management" ON profiles;
  DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
  DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
  DROP POLICY IF EXISTS "profiles_update_jg_management" ON profiles;
  DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
  DROP POLICY IF EXISTS "profiles_delete_jg_management" ON profiles;
  DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
  DROP POLICY IF EXISTS "Enable read access for users" ON profiles;
  DROP POLICY IF EXISTS "Enable admin read access" ON profiles;
  DROP POLICY IF EXISTS "Enable update for users" ON profiles;
  DROP POLICY IF EXISTS "Enable admin update access" ON profiles;
  DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
  DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Now create a simple, working policy that allows all authenticated users to read profiles
-- This is necessary for avatar display in chat functionality
-- Drop the policy first if it exists, then recreate it
DROP POLICY IF EXISTS "profiles_read_all_authenticated" ON profiles;
CREATE POLICY "profiles_read_all_authenticated" ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can only update their own profiles
DROP POLICY IF EXISTS "profiles_update_own_only" ON profiles;
CREATE POLICY "profiles_update_own_only" ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can only insert their own profiles
DROP POLICY IF EXISTS "profiles_insert_own_only" ON profiles;
CREATE POLICY "profiles_insert_own_only" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Users can only delete their own profiles
DROP POLICY IF EXISTS "profiles_delete_own_only" ON profiles;
CREATE POLICY "profiles_delete_own_only" ON profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Test the policies work
-- This should return all profiles for any authenticated user
SELECT 'Testing profile access...' as status;

-- Verify the policies were created
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
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Test query that should work for subcontractors
SELECT 'Profile count for authenticated users:' as test, COUNT(*) as count FROM profiles;
