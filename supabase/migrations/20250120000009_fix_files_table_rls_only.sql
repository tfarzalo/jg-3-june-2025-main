/*
  # Fix Files Table RLS Policies Only

  This migration focuses only on fixing the files table RLS policies.
  Storage policies may need to be managed through the Supabase dashboard
  if the migration doesn't have sufficient permissions.

  1. Changes
    - Clean up conflicting RLS policies on files table
    - Ensure proper access for authenticated users

  2. Storage Policies
    - If storage policies fail, create them manually in Supabase dashboard:
      - Files are publicly accessible (SELECT, public, bucket_id = files)
      - Authenticated users can upload files (INSERT, authenticated, bucket_id = files)
      - Authenticated users can update files (UPDATE, authenticated, bucket_id = files)
      - Authenticated users can delete files (DELETE, authenticated, bucket_id = files)
*/

-- Ensure the files bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Ensure files table has proper RLS policies
-- Drop existing policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON files;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON files;
  DROP POLICY IF EXISTS "Enable update for authenticated users" ON files;
  DROP POLICY IF EXISTS "Enable delete for authenticated users" ON files;
  DROP POLICY IF EXISTS "Allow users to view their own files" ON files;
  DROP POLICY IF EXISTS "Allow authenticated users to create files" ON files;
  DROP POLICY IF EXISTS "Allow users to update their own files" ON files;
  DROP POLICY IF EXISTS "Allow users to delete their own files" ON files;
  DROP POLICY IF EXISTS "Allow authenticated users to view root folders" ON files;
  DROP POLICY IF EXISTS "Files read access for authenticated users" ON files;
  DROP POLICY IF EXISTS "Files insert access for authenticated users" ON files;
  DROP POLICY IF EXISTS "Files update access for authenticated users" ON files;
  DROP POLICY IF EXISTS "Files delete access for authenticated users" ON files;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create comprehensive RLS policies for files table
CREATE POLICY "Files read access for authenticated users"
  ON files
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Files insert access for authenticated users"
  ON files
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Files update access for authenticated users"
  ON files
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Files delete access for authenticated users"
  ON files
  FOR DELETE
  TO authenticated
  USING (true);

-- Add comments for documentation
COMMENT ON POLICY "Files read access for authenticated users" ON files IS 'Allows authenticated users to read all files';
COMMENT ON POLICY "Files insert access for authenticated users" ON files IS 'Allows authenticated users to create files';
COMMENT ON POLICY "Files update access for authenticated users" ON files IS 'Allows authenticated users to update files';
COMMENT ON POLICY "Files delete access for authenticated users" ON files IS 'Allows authenticated users to delete files';
