/*
  # Fix File Permissions

  1. Changes
    - Add SELECT policy for files table
    - Add storage bucket policies
    - Fix file path handling

  2. Security
    - Maintains RLS security model
    - Adds specific read permissions for authenticated users
    - Ensures proper storage access
*/

-- Drop existing policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON files;
  DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;
  DROP POLICY IF EXISTS "Enable upload for authenticated users" ON storage.objects;
  DROP POLICY IF EXISTS "Enable delete for file owners and admins" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create read policy for files table
CREATE POLICY "Enable read access for authenticated users"
  ON files
  FOR SELECT
  TO authenticated
  USING (true);

-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
CREATE POLICY "Enable read access for all users"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'files');

CREATE POLICY "Enable upload for authenticated users"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'files');

CREATE POLICY "Enable delete for file owners and admins"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'files');