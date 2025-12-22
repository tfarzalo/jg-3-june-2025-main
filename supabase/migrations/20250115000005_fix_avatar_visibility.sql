-- Fix Avatar Visibility for All Users
-- This migration ensures that all authenticated users can see avatars for all user types
-- while maintaining proper security for profile data

-- First, let's clean up any conflicting policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated SELECT on profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated UPDATE on profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated DELETE on profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated INSERT on profiles" ON profiles;
  DROP POLICY IF EXISTS "profiles_select_subcontractors" ON profiles;
  DROP POLICY IF EXISTS "profiles_select_jg_management" ON profiles;
  DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
  DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
  DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_update_jg_management" ON profiles;
  DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
  DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
  DROP POLICY IF EXISTS "profiles_delete_jg_management" ON profiles;
  DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
  DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Ensure RLS is enabled on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create comprehensive policies for profiles table
-- These policies ensure avatar visibility while maintaining security

-- SELECT Policy: All authenticated users can see basic profile info (including avatars)
-- This is essential for avatar visibility in chat and user lists
CREATE POLICY "profiles_select_authenticated" ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- UPDATE Policy: Users can only update their own profiles
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT Policy: Users can create their own profiles
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- DELETE Policy: Users can only delete their own profiles
CREATE POLICY "profiles_delete_own" ON profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);

-- Ensure the avatars storage bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Clean up any conflicting storage policies
DO $$ BEGIN
  DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create storage policies for avatars bucket
-- Avatar images should be publicly accessible for display purposes
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Users can upload their own avatars
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1]::text = auth.uid()::text
  );

-- Users can update their own avatars
CREATE POLICY "Users can update their own avatar"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1]::text = auth.uid()::text
  );

-- Users can delete their own avatars
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1]::text = auth.uid()::text
  );

-- Create a function to get avatar URL for any user
-- This function can be used by the frontend to construct avatar URLs
CREATE OR REPLACE FUNCTION get_avatar_url(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  avatar_path TEXT;
  avatar_url TEXT;
BEGIN
  -- Get the avatar_url from the profiles table
  SELECT avatar_url INTO avatar_path
  FROM profiles
  WHERE id = user_id;
  
  -- If no avatar_url is set, return null
  IF avatar_path IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Construct the full URL
  -- This assumes your Supabase project URL is available
  avatar_url := 'https://' || current_setting('app.settings.supabase_url', true) || '/storage/v1/object/public/avatars/' || avatar_path;
  
  RETURN avatar_url;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_avatar_url(UUID) TO authenticated;

-- Create a view for public profile information (including avatars)
-- This view can be used for displaying user information without exposing sensitive data
CREATE OR REPLACE VIEW public_profile_info AS
SELECT 
  id,
  email,
  full_name,
  role,
  avatar_url,
  last_seen,
  created_at
FROM profiles;

-- Grant access to the view for authenticated users
GRANT SELECT ON public_profile_info TO authenticated;

-- Add comment explaining the purpose
COMMENT ON VIEW public_profile_info IS 'Public profile information view for displaying user avatars and basic info in chat and user lists';
COMMENT ON FUNCTION get_avatar_url(UUID) IS 'Function to get avatar URL for any user, used for displaying avatars in chat and user lists';
