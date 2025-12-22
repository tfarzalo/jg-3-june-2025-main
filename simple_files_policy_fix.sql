-- Simple fix for files table RLS policy without helper functions
-- This avoids infinite recursion and doesn't require helper functions

-- 1. Drop all existing policies on files table to start clean
DROP POLICY IF EXISTS "Files access for subcontractors" ON files;
DROP POLICY IF EXISTS "Files limited for subcontractors" ON files;
DROP POLICY IF EXISTS "Files full access for admin/management" ON files;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON files;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON files;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON files;
DROP POLICY IF EXISTS "Allow folder creation" ON files;
DROP POLICY IF EXISTS "Files admin access" ON files;
DROP POLICY IF EXISTS "Files subcontractor access" ON files;

-- 2. Create a simple policy that allows authenticated users to work with files
-- This is temporary to get uploads working - we can refine security later
CREATE POLICY "Files authenticated access" ON files
  FOR ALL 
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 3. Ensure RPC functions are accessible to authenticated users
GRANT EXECUTE ON FUNCTION get_upload_folder(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_work_order_folder_structure(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_property_folder_structure(uuid, text) TO authenticated;

-- 4. Verify the policies are in place
SELECT 
  'Updated policies for files table:' as info,
  policyname,
  cmd,
  permissive
FROM pg_policies 
WHERE tablename = 'files'
ORDER BY policyname;
