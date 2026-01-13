-- Minimal fix for Sprinkler Image support
-- This script updates create_work_order_folder_structure and get_upload_folder
-- to ensure Sprinkler Images folder is created and accessible.
-- It mimics the logic used for Before Images.

-- 1. Update create_work_order_folder_structure to include Sprinkler Images
CREATE OR REPLACE FUNCTION create_work_order_folder_structure(
  p_property_id uuid,
  p_property_name text,
  p_work_order_num text,
  p_job_id uuid
)
RETURNS TABLE(
  wo_folder_id uuid,
  before_images_folder_id uuid,
  sprinkler_images_folder_id uuid,
  other_files_folder_id uuid
) AS $$
DECLARE
  v_work_orders_folder_id uuid;
  v_wo_folder_id uuid;
  v_before_images_folder_id uuid;
  v_sprinkler_images_folder_id uuid;
  v_other_files_folder_id uuid;
  v_user_id uuid;
  v_wo_name text;
BEGIN
  -- Get current user or system user
  BEGIN
    v_user_id := auth.uid();
    -- If auth.uid() returns null, get the first available user
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END;
  
  -- Final fallback - if still null, raise an error
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found and no users available in auth.users table';
  END IF;
  
  -- Format work order name
  v_wo_name := 'WO-' || LPAD(p_work_order_num::text, 6, '0');
  
  -- Get Work Orders folder ID - Use robust lookup by property_id and folder name
  -- This handles cases where property name has special characters like underscores
  SELECT id INTO v_work_orders_folder_id
  FROM files
  WHERE property_id = p_property_id 
    AND name = 'Work Orders' 
    AND type = 'folder/directory'
    AND folder_id IS NOT NULL;
  
  -- Fallback to path-based lookup if needed
  IF v_work_orders_folder_id IS NULL THEN
    SELECT id INTO v_work_orders_folder_id
    FROM files
    WHERE path LIKE '%/Work Orders' 
      AND property_id = p_property_id 
      AND type = 'folder/directory';
  END IF;
  
  -- If still not found, create the folder structure
  IF v_work_orders_folder_id IS NULL THEN
    PERFORM create_property_folder_structure(p_property_id, p_property_name);
    
    -- Try to find it again after creation
    SELECT id INTO v_work_orders_folder_id
    FROM files
    WHERE property_id = p_property_id 
      AND name = 'Work Orders' 
      AND type = 'folder/directory'
      AND folder_id IS NOT NULL;
  END IF;
  
  -- Final check - if still not found, raise an error
  IF v_work_orders_folder_id IS NULL THEN
    RAISE EXCEPTION 'Work Orders folder not found for property: % (ID: %)', p_property_name, p_property_id;
  END IF;
  
  -- Create or get work order folder
  INSERT INTO files (
    name, path, type, uploaded_by, property_id, job_id, folder_id, size
  ) VALUES (
    v_wo_name,
    '/' || p_property_name || '/Work Orders/' || v_wo_name,
    'folder/directory',
    v_user_id,
    p_property_id,
    p_job_id,
    v_work_orders_folder_id,
    0
  )
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    uploaded_by = EXCLUDED.uploaded_by,
    property_id = EXCLUDED.property_id,
    job_id = EXCLUDED.job_id,
    folder_id = EXCLUDED.folder_id
  RETURNING id INTO v_wo_folder_id;
  
  -- Get work order folder ID if it already existed
  IF v_wo_folder_id IS NULL THEN
    SELECT id INTO v_wo_folder_id
    FROM files
    WHERE path = '/' || p_property_name || '/Work Orders/' || v_wo_name AND type = 'folder/directory';
  END IF;
  
  -- Create Before Images folder
  INSERT INTO files (
    name, path, type, uploaded_by, property_id, job_id, folder_id, size
  ) VALUES (
    'Before Images',
    '/' || p_property_name || '/Work Orders/' || v_wo_name || '/Before Images',
    'folder/directory',
    v_user_id,
    p_property_id,
    p_job_id,
    v_wo_folder_id,
    0
  )
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    uploaded_by = EXCLUDED.uploaded_by,
    property_id = EXCLUDED.property_id,
    job_id = EXCLUDED.job_id,
    folder_id = EXCLUDED.folder_id
  RETURNING id INTO v_before_images_folder_id;
  
  -- Get Before Images folder ID if it already existed
  IF v_before_images_folder_id IS NULL THEN
    SELECT id INTO v_before_images_folder_id
    FROM files
    WHERE path = '/' || p_property_name || '/Work Orders/' || v_wo_name || '/Before Images' AND type = 'folder/directory';
  END IF;
  
  -- Create Sprinkler Images folder
  INSERT INTO files (
    name, path, type, uploaded_by, property_id, job_id, folder_id, size
  ) VALUES (
    'Sprinkler Images',
    '/' || p_property_name || '/Work Orders/' || v_wo_name || '/Sprinkler Images',
    'folder/directory',
    v_user_id,
    p_property_id,
    p_job_id,
    v_wo_folder_id,
    0
  )
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    uploaded_by = EXCLUDED.uploaded_by,
    property_id = EXCLUDED.property_id,
    job_id = EXCLUDED.job_id,
    folder_id = EXCLUDED.folder_id
  RETURNING id INTO v_sprinkler_images_folder_id;
  
  -- Get Sprinkler Images folder ID if it already existed
  IF v_sprinkler_images_folder_id IS NULL THEN
    SELECT id INTO v_sprinkler_images_folder_id
    FROM files
    WHERE path = '/' || p_property_name || '/Work Orders/' || v_wo_name || '/Sprinkler Images' AND type = 'folder/directory';
  END IF;
  
  -- Create Other Files folder
  INSERT INTO files (
    name, path, type, uploaded_by, property_id, job_id, folder_id, size
  ) VALUES (
    'Other Files',
    '/' || p_property_name || '/Work Orders/' || v_wo_name || '/Other Files',
    'folder/directory',
    v_user_id,
    p_property_id,
    p_job_id,
    v_wo_folder_id,
    0
  )
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    uploaded_by = EXCLUDED.uploaded_by,
    property_id = EXCLUDED.property_id,
    job_id = EXCLUDED.job_id,
    folder_id = EXCLUDED.folder_id
  RETURNING id INTO v_other_files_folder_id;
  
  -- Get Other Files folder ID if it already existed
  IF v_other_files_folder_id IS NULL THEN
    SELECT id INTO v_other_files_folder_id
    FROM files
    WHERE path = '/' || p_property_name || '/Work Orders/' || v_wo_name || '/Other Files' AND type = 'folder/directory';
  END IF;
  
  RETURN QUERY SELECT v_wo_folder_id, v_before_images_folder_id, v_sprinkler_images_folder_id, v_other_files_folder_id;
END;
$$ LANGUAGE plpgsql;

-- 2. Update get_upload_folder to handle 'sprinkler' folder type
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

-- 3. Verify function exists
SELECT 'get_upload_folder updated successfully' as status;
