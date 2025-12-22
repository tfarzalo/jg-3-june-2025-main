-- Fix infinite recursion in files table RLS policy
-- The issue is that the policy is checking the files table while evaluating access to the files table

-- 1. Drop all existing policies on files table to start clean
DROP POLICY IF EXISTS "Files access for subcontractors" ON files;
DROP POLICY IF EXISTS "Files limited for subcontractors" ON files;
DROP POLICY IF EXISTS "Files full access for admin/management" ON files;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON files;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON files;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON files;
DROP POLICY IF EXISTS "Allow folder creation" ON files;

-- 2. Create simple, non-recursive policies
-- Policy for admin/management users (full access)
CREATE POLICY "Files admin access" ON files
  FOR ALL 
  TO authenticated
  USING (public.is_admin_or_management())
  WITH CHECK (public.is_admin_or_management());

-- Policy for subcontractors (simplified to avoid recursion)
CREATE POLICY "Files subcontractor access" ON files
  FOR ALL 
  TO authenticated
  USING (
    public.is_subcontractor() AND (
      -- Can access files they uploaded
      uploaded_by = auth.uid()
      -- Can access files from jobs they're assigned to (without checking files table)
      OR job_id IN (
        SELECT id FROM jobs WHERE assigned_to = auth.uid()
      )
      -- Can access files from properties they work on (without checking files table)
      OR property_id IN (
        SELECT DISTINCT property_id FROM jobs WHERE assigned_to = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_subcontractor() AND (
      -- Can create files they upload
      uploaded_by = auth.uid()
      -- Can create files in jobs they're assigned to
      OR job_id IN (
        SELECT id FROM jobs WHERE assigned_to = auth.uid()
      )
      -- Can create files in properties they work on
      OR property_id IN (
        SELECT DISTINCT property_id FROM jobs WHERE assigned_to = auth.uid()
      )
      -- Can create folders (this is the key part for the upload issue)
      OR type = 'folder/directory'
    )
  );

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
