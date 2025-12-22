/*
  # Fix Profiles RLS Policies

  1. Changes
    - Remove recursive policies that were causing infinite loops
    - Implement simplified RLS policies for profiles table
    - Add proper role-based access control without recursion

  2. Security
    - Users can still only view and update their own profiles
    - Admins maintain ability to manage all profiles
    - Prevents infinite recursion by avoiding nested role checks
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create new, simplified policies

-- Allow users to view their own profile
CREATE POLICY "Enable read access for users"
ON profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

-- Allow admins to view all profiles
CREATE POLICY "Enable admin read access"
ON profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);

-- Allow users to update their own profile
CREATE POLICY "Enable update for users"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow admins to update all profiles
CREATE POLICY "Enable admin update access"
ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_user_meta_data->>'role' = 'admin'
  )
);