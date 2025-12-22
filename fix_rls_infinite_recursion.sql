-- Fix RLS Infinite Recursion Issue
-- This script removes problematic RLS policies and recreates them properly

-- First, let's see what policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'profiles';

-- Disable RLS temporarily to see if that fixes the issue
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Check if the table is accessible now
SELECT COUNT(*) FROM profiles LIMIT 1;

-- If that works, let's recreate the policies properly
-- First, drop all existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
DROP POLICY IF EXISTS "Allow read working_days for scheduling" ON profiles;
DROP POLICY IF EXISTS "Allow update working_days for admins" ON profiles;
DROP POLICY IF EXISTS "Users can read own availability" ON profiles;
DROP POLICY IF EXISTS "Users can update own availability" ON profiles;
DROP POLICY IF EXISTS "Users can read own communication_preferences" ON profiles;
DROP POLICY IF EXISTS "Users can update own communication_preferences" ON profiles;
DROP POLICY IF EXISTS "Users can read own professional_info" ON profiles;
DROP POLICY IF EXISTS "Users can update own professional_info" ON profiles;
DROP POLICY IF EXISTS "Users can read own social_media" ON profiles;
DROP POLICY IF EXISTS "Users can update own social_media" ON profiles;

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile" ON profiles
    FOR DELETE USING (auth.uid() = id);

-- Test the policies
SELECT COUNT(*) FROM profiles WHERE id = auth.uid() LIMIT 1;

-- If successful, commit the changes
-- If not, we may need to investigate further
