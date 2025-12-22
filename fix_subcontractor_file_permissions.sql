-- Fix subcontractor permissions for file operations
-- The issue is that subcontractors can't create folders/files due to RLS policies

-- 1. First, let's see the current policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'files'
ORDER BY policyname;

-- 2. Drop existing restrictive policies for subcontractors
DROP POLICY IF EXISTS "Files limited for subcontractors" ON files;

-- 3. Create comprehensive policies for subcontractors on files table
CREATE POLICY "Files read for subcontractors" ON files
  FOR SELECT 
  TO authenticated
  USING (
    public.is_subcontractor() AND (
      -- Can read files they uploaded
      uploaded_by = auth.uid()
      -- Can read files from jobs they have access to
      OR job_id IN (
        SELECT j.id FROM jobs j
        WHERE EXISTS (
          SELECT 1 FROM work_orders wo
          WHERE wo.job_id = j.id
          AND wo.assigned_to = auth.uid()
        )
      )
      -- Can read files from properties they work on
      OR property_id IN (
        SELECT DISTINCT j.property_id 
        FROM jobs j
        JOIN work_orders wo ON wo.job_id = j.id
        WHERE wo.assigned_to = auth.uid()
      )
    )
  );

CREATE POLICY "Files insert for subcontractors" ON files
  FOR INSERT 
  TO authenticated
  WITH CHECK (
    public.is_subcontractor() AND (
      -- Can create files in folders for jobs they're assigned to
      job_id IN (
        SELECT j.id FROM jobs j
        WHERE EXISTS (
          SELECT 1 FROM work_orders wo
          WHERE wo.job_id = j.id
          AND wo.assigned_to = auth.uid()
        )
      )
      -- Can create files in property folders they work on
      OR property_id IN (
        SELECT DISTINCT j.property_id 
        FROM jobs j
        JOIN work_orders wo ON wo.job_id = j.id
        WHERE wo.assigned_to = auth.uid()
      )
      -- Can create folders (type = 'folder/directory')
      OR type = 'folder/directory'
    )
  );

CREATE POLICY "Files update for subcontractors" ON files
  FOR UPDATE 
  TO authenticated
  USING (
    public.is_subcontractor() AND (
      -- Can update files they uploaded
      uploaded_by = auth.uid()
      -- Can update files in jobs they're assigned to
      OR job_id IN (
        SELECT j.id FROM jobs j
        WHERE EXISTS (
          SELECT 1 FROM work_orders wo
          WHERE wo.job_id = j.id
          AND wo.assigned_to = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    public.is_subcontractor() AND (
      -- Can update files they uploaded
      uploaded_by = auth.uid()
      -- Can update files in jobs they're assigned to
      OR job_id IN (
        SELECT j.id FROM jobs j
        WHERE EXISTS (
          SELECT 1 FROM work_orders wo
          WHERE wo.job_id = j.id
          AND wo.assigned_to = auth.uid()
        )
      )
    )
  );

-- 4. Grant necessary permissions to authenticated users for RPC functions
GRANT EXECUTE ON FUNCTION get_upload_folder(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_work_order_folder_structure(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_property_folder_structure(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_folder(text, uuid) TO authenticated;

-- 5. Test the permissions by checking if a subcontractor can access the function
-- This will show if the RPC function is accessible
SELECT 
  'Testing subcontractor access to get_upload_folder function' as test,
  has_function_privilege('authenticated', 'get_upload_folder(uuid, uuid, text)', 'EXECUTE') as can_execute;

-- 6. Verify the policies are in place
SELECT 
  'Updated policies for files table:' as info,
  policyname,
  cmd,
  permissive
FROM pg_policies 
WHERE tablename = 'files'
ORDER BY policyname;
