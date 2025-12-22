-- VERIFICATION SCRIPT
-- Run this to check if the database is ready for the new Blob saving strategy.

-- 1. Check if 'files' table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'files'
) as files_table_exists;

-- 2. Check for the restrictive constraint (Should be FALSE or empty)
SELECT conname 
FROM pg_constraint 
WHERE conname = 'valid_file_type';

-- 3. Check RLS Policies
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'files';

-- 4. Check Storage Bucket
SELECT id, name, public 
FROM storage.buckets 
WHERE id = 'files';

-- 5. Check Storage Policies (Correct view name is pg_policies or querying pg_catalog directly, but for storage we check differently)
-- Actually, Storage policies are also in pg_policies but on the 'objects' table in the 'storage' schema
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects';
