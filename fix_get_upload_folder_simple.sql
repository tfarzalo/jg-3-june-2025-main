-- Fix the get_upload_folder function - Simple version

-- 1. Drop and recreate the function with proper error handling
DROP FUNCTION IF EXISTS get_upload_folder(uuid,uuid,text);

CREATE OR REPLACE FUNCTION get_upload_folder(
  p_property_id uuid,
  p_job_id uuid DEFAULT NULL,
  p_folder_type text DEFAULT 'other'
)
RETURNS uuid AS $$
DECLARE
  v_property_name text;
  v_work_order_num text;
  v_folder_id uuid;
  v_folder_path text;
  v_user_id uuid;
BEGIN
  -- Get current user or system user
  BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END;
  
  -- Get property name
  SELECT property_name INTO v_property_name
  FROM properties
  WHERE id = p_property_id;
  
  IF v_property_name IS NULL THEN
    RAISE EXCEPTION 'Property not found: %', p_property_id;
  END IF;
  
  -- If no job_id, return Property Files folder
  IF p_job_id IS NULL THEN
    SELECT id INTO v_folder_id
    FROM files
    WHERE path = '/' || v_property_name || '/Property Files' AND type = 'folder/directory';
    
    IF v_folder_id IS NULL THEN
      -- Create property folder structure
      PERFORM create_property_folder_structure(p_property_id, v_property_name);
      
      SELECT id INTO v_folder_id
      FROM files
      WHERE path = '/' || v_property_name || '/Property Files' AND type = 'folder/directory';
    END IF;
    
    RETURN v_folder_id;
  END IF;
  
  -- Get work order number
  SELECT work_order_num INTO v_work_order_num
  FROM jobs
  WHERE id = p_job_id;
  
  IF v_work_order_num IS NULL THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;
  
  -- Build folder path based on folder type
  CASE p_folder_type
    WHEN 'before' THEN
      v_folder_path := '/' || v_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0') || '/Before Images';
    WHEN 'sprinkler' THEN
      v_folder_path := '/' || v_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0') || '/Sprinkler Images';
    WHEN 'other' THEN
      v_folder_path := '/' || v_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0') || '/Other Files';
    ELSE
      v_folder_path := '/' || v_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0') || '/Other Files';
  END CASE;
  
  -- Get folder ID
  SELECT id INTO v_folder_id
  FROM files
  WHERE path = v_folder_path AND type = 'folder/directory';
  
  IF v_folder_id IS NULL THEN
    -- Create work order folder structure
    PERFORM create_work_order_folder_structure(
      p_property_id,
      v_property_name,
      v_work_order_num::text,
      p_job_id
    );
    
    SELECT id INTO v_folder_id
    FROM files
    WHERE path = v_folder_path AND type = 'folder/directory';
  END IF;
  
  RETURN v_folder_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Test the function with the specific property and job from the error
SELECT 'TESTING FIXED FUNCTION:' as status;

-- Test with Property Files folder (no job_id)
SELECT 
  'Property Files folder' as test_type,
  get_upload_folder(
    '86585c6c-93b4-44c9-a7a5-5be077e8e2a8'::uuid,
    NULL,
    'other'
  ) as folder_id;

-- Test with Work Orders folder (with job_id)
SELECT 
  'Work Orders Before Images folder' as test_type,
  get_upload_folder(
    '86585c6c-93b4-44c9-a7a5-5be077e8e2a8'::uuid,
    'd3818d76-ba6b-4903-aa42-db46c911e5d7'::uuid,
    'before'
  ) as folder_id;

-- 3. Verify the returned folder IDs
SELECT 'VERIFYING RETURNED FOLDER IDs:' as status;
SELECT 
  id,
  name,
  path,
  type
FROM files 
WHERE id IN (
  get_upload_folder('86585c6c-93b4-44c9-a7a5-5be077e8e2a8'::uuid, NULL, 'other'),
  get_upload_folder('86585c6c-93b4-44c9-a7a5-5be077e8e2a8'::uuid, 'd3818d76-ba6b-4903-aa42-db46c911e5d7'::uuid, 'before')
);
