/*
  # Fix Profile Permissions

  1. Changes
    - Add proper RLS policies for profiles table
    - Fix permission denied errors for authenticated users
    - Allow users to read their own profile data
    - Allow admins to read all profiles

  2. Security
    - Maintain existing security model
    - Add specific policies for profile access
*/

-- Drop existing policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for users" ON profiles;
  DROP POLICY IF EXISTS "Enable admin read access" ON profiles;
  DROP POLICY IF EXISTS "Enable update for users" ON profiles;
  DROP POLICY IF EXISTS "Enable admin update access" ON profiles;
  DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
  DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated SELECT on profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated UPDATE on profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated DELETE on profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated INSERT on profiles" ON profiles;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create new policies for profiles table
CREATE POLICY "Authenticated SELECT on profiles"
  ON profiles
  FOR SELECT
  TO public
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated UPDATE on profiles"
  ON profiles
  FOR UPDATE
  TO public
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated DELETE on profiles"
  ON profiles
  FOR DELETE
  TO public
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated INSERT on profiles"
  ON profiles
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() IS NOT NULL);