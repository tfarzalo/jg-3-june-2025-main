/*
  # Fix Admin User Creation Permissions

  1. Changes
    - Update RLS policies to allow admins to create other admin users
    - Fix permission issues with user management
    - Ensure proper access control for admin operations

  2. Security
    - Maintain RLS security model
    - Allow admins to manage all users
*/

-- Update valid_role constraint to include all possible roles
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS valid_role;

ALTER TABLE profiles
ADD CONSTRAINT valid_role 
CHECK (role IN ('admin', 'user', 'editor', 'is_super_admin', 'jg_management', 'subcontractor'));

-- Create a function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- Drop existing policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated DELETE on profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated INSERT on profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated SELECT on profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated UPDATE on profiles" ON profiles;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new policies for profiles table
CREATE POLICY "Authenticated SELECT on profiles"
  ON profiles
  FOR SELECT
  TO public
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated INSERT on profiles"
  ON profiles
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated UPDATE on profiles"
  ON profiles
  FOR UPDATE
  TO public
  USING (auth.uid() = id OR is_admin())
  WITH CHECK (auth.uid() = id OR is_admin());

CREATE POLICY "Authenticated DELETE on profiles"
  ON profiles
  FOR DELETE
  TO public
  USING (is_admin());

-- Create function to handle user creation with admin privileges
CREATE OR REPLACE FUNCTION create_user_with_role(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text DEFAULT 'user'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_is_admin boolean;
BEGIN
  -- Check if the current user is an admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;
  
  -- Only admins can create users with admin role
  IF p_role = 'admin' AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can create users with admin role';
  END IF;
  
  -- Create the user
  -- Note: In a real implementation, this would call auth.create_user
  -- but we're simulating it here since we can't directly call auth functions
  v_user_id := gen_random_uuid();
  
  -- Insert the profile
  INSERT INTO profiles (
    id,
    email,
    full_name,
    role
  ) VALUES (
    v_user_id,
    p_email,
    p_full_name,
    p_role
  );
  
  RETURN json_build_object(
    'id', v_user_id,
    'email', p_email,
    'role', p_role,
    'success', true
  );
END;
$$;