-- Quick fix for subcontractor file permissions
-- This allows subcontractors to create folders and files for their assigned work orders

-- 1. Drop the restrictive subcontractor policy
DROP POLICY IF EXISTS "Files limited for subcontractors" ON files;

-- 2. Create a more permissive policy for subcontractors
CREATE POLICY "Files access for subcontractors" ON files
  FOR ALL 
  TO authenticated
  USING (
    public.is_subcontractor() AND (
      -- Can access files they uploaded
      uploaded_by = auth.uid()
      -- Can access files from jobs they're assigned to
      OR job_id IN (
        SELECT j.id FROM jobs j
        WHERE j.assigned_to = auth.uid()
      )
      -- Can access files from properties they work on
      OR property_id IN (
        SELECT DISTINCT j.property_id 
        FROM jobs j
        WHERE j.assigned_to = auth.uid()
      )
      -- Can create folders (this is the key part)
      OR type = 'folder/directory'
    )
  )
  WITH CHECK (
    public.is_subcontractor() AND (
      -- Can create files they upload
      uploaded_by = auth.uid()
      -- Can create files in jobs they're assigned to
      OR job_id IN (
        SELECT j.id FROM jobs j
        WHERE j.assigned_to = auth.uid()
      )
      -- Can create files in properties they work on
      OR property_id IN (
        SELECT DISTINCT j.property_id 
        FROM jobs j
        WHERE j.assigned_to = auth.uid()
      )
      -- Can create folders (this is the key part)
      OR type = 'folder/directory'
    )
  );

-- 3. Ensure RPC functions are accessible to authenticated users
GRANT EXECUTE ON FUNCTION get_upload_folder(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_work_order_folder_structure(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_property_folder_structure(uuid, text) TO authenticated;

-- 4. Test the fix
SELECT 
  'Subcontractor permissions updated successfully' as status,
  'Files table policies:' as info;

SELECT 
  policyname,
  cmd,
  permissive
FROM pg_policies 
WHERE tablename = 'files'
ORDER BY policyname;
