/*
  # Add User Profile Fields

  1. Changes
    - Add new columns to profiles table for user profile information
    - Add avatar_url for profile pictures
    - Add nickname, mobile_phone, sms_phone, bio fields
    - Add username field for display purposes
    - Add theme_preference for UI customization
    - Add work_schedule for availability tracking

  2. Security
    - Maintain existing RLS policies
    - Ensure proper access control
*/

-- Add new columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS nickname text,
ADD COLUMN IF NOT EXISTS mobile_phone text,
ADD COLUMN IF NOT EXISTS sms_phone text,
ADD COLUMN IF NOT EXISTS bio text,
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS theme_preference text,
ADD COLUMN IF NOT EXISTS work_schedule text[];

-- Create storage bucket for avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies for avatars
DO $$ BEGIN
  CREATE POLICY "Avatar images are publicly accessible"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'avatars');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can upload their own avatar"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'avatars' AND
      (storage.foldername(name))[1]::text = auth.uid()::text
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own avatar"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'avatars' AND
      (storage.foldername(name))[1]::text = auth.uid()::text
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own avatar"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'avatars' AND
      (storage.foldername(name))[1]::text = auth.uid()::text
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Update valid_role constraint to include new roles
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS valid_role;

ALTER TABLE profiles
ADD CONSTRAINT valid_role 
CHECK (role IN ('admin', 'user', 'editor', 'is_super_admin', 'jg_management', 'subcontractor'));