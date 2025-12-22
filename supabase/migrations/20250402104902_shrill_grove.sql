-- Drop existing policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Authenticated DELETE on profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated INSERT on profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated SELECT on profiles" ON profiles;
  DROP POLICY IF EXISTS "Authenticated UPDATE on profiles" ON profiles;
  DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
  DROP POLICY IF EXISTS "Enable read access for users" ON profiles;
  DROP POLICY IF EXISTS "Enable admin read access" ON profiles;
  DROP POLICY IF EXISTS "Enable update for users" ON profiles;
  DROP POLICY IF EXISTS "Enable admin update access" ON profiles;
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

CREATE POLICY "Authenticated INSERT on profiles"
  ON profiles
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated UPDATE on profiles"
  ON profiles
  FOR UPDATE
  TO public
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Authenticated DELETE on profiles"
  ON profiles
  FOR DELETE
  TO public
  USING (auth.uid() IS NOT NULL);

-- Create storage bucket for avatars if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
  DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update avatars" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete avatars" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create storage policies for avatars bucket
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Users can update avatars"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can delete avatars"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars');

-- Create storage policies for files bucket
CREATE POLICY "Files are publicly accessible"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'files');

CREATE POLICY "Users can upload files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'files');

CREATE POLICY "Users can update files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'files');

CREATE POLICY "Users can delete files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'files');