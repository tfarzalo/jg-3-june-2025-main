-- Manual Storage Policies for Files Bucket
-- Run these in the Supabase Dashboard > Storage > Policies if the migration fails

-- 1. Drop existing policies (run these first)
DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;
DROP POLICY IF EXISTS "Enable upload for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for file owners and admins" ON storage.objects;
DROP POLICY IF EXISTS "Files are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete files" ON storage.objects;

-- 2. Create new policies
CREATE POLICY "Files are publicly accessible"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'files');

CREATE POLICY "Authenticated users can upload files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'files');

CREATE POLICY "Authenticated users can update files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'files')
  WITH CHECK (bucket_id = 'files');

CREATE POLICY "Authenticated users can delete files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'files');
