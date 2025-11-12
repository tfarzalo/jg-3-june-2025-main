-- Create a SQL function to sanitize property names for storage paths
-- This ensures consistent path formatting: spaces -> underscores, lowercase

CREATE OR REPLACE FUNCTION sanitize_for_storage(input_text text)
RETURNS text AS $$
BEGIN
  IF input_text IS NULL OR input_text = '' THEN
    RETURN '';
  END IF;
  
  -- Convert to lowercase, replace spaces with underscores, remove special chars
  RETURN regexp_replace(
    regexp_replace(
      regexp_replace(
        lower(trim(input_text)),
        '\s+', '_', 'g'  -- Replace spaces with underscores
      ),
      '[^a-z0-9_-]', '', 'g'  -- Remove invalid characters
    ),
    '_+', '_', 'g'  -- Collapse multiple underscores
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update create_property_folder_structure to use sanitized paths
CREATE OR REPLACE FUNCTION create_property_folder_structure(p_property_id uuid, p_property_name text)
RETURNS TABLE(
  property_folder_id uuid,
  work_orders_folder_id uuid,
  property_files_folder_id uuid
) AS $$
DECLARE
  v_property_folder_id uuid;
  v_work_orders_folder_id uuid;
  v_property_files_folder_id uuid;
  v_user_id uuid;
  v_sanitized_name text;
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
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found and no users available in auth.users table';
  END IF;
  
  -- Sanitize property name for storage paths
  v_sanitized_name := sanitize_for_storage(p_property_name);
  
  -- Create or get property folder (use display name, sanitized path)
  INSERT INTO files (
    name, path, type, uploaded_by, property_id, folder_id, size
  ) VALUES (
    p_property_name,  -- Display name with spaces
    v_sanitized_name,  -- Storage path with underscores
    'folder/directory',
    v_user_id,
    p_property_id,
    NULL,
    0
  )
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    uploaded_by = EXCLUDED.uploaded_by,
    property_id = EXCLUDED.property_id
  RETURNING id INTO v_property_folder_id;
  
  IF v_property_folder_id IS NULL THEN
    SELECT id INTO v_property_folder_id
    FROM files
    WHERE path = v_sanitized_name AND type = 'folder/directory';
  END IF;
  
  -- Create or get Work Orders folder
  INSERT INTO files (
    name, path, type, uploaded_by, property_id, folder_id, size
  ) VALUES (
    'Work Orders',
    v_sanitized_name || '/Work_Orders',
    'folder/directory',
    v_user_id,
    p_property_id,
    v_property_folder_id,
    0
  )
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    uploaded_by = EXCLUDED.uploaded_by,
    property_id = EXCLUDED.property_id,
    folder_id = EXCLUDED.folder_id
  RETURNING id INTO v_work_orders_folder_id;
  
  IF v_work_orders_folder_id IS NULL THEN
    SELECT id INTO v_work_orders_folder_id
    FROM files
    WHERE path = v_sanitized_name || '/Work_Orders' AND type = 'folder/directory';
  END IF;
  
  -- Create or get Property Files folder
  INSERT INTO files (
    name, path, type, uploaded_by, property_id, folder_id, size
  ) VALUES (
    'Property Files',
    v_sanitized_name || '/Property_Files',
    'folder/directory',
    v_user_id,
    p_property_id,
    v_property_folder_id,
    0
  )
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    uploaded_by = EXCLUDED.uploaded_by,
    property_id = EXCLUDED.property_id,
    folder_id = EXCLUDED.folder_id
  RETURNING id INTO v_property_files_folder_id;
  
  IF v_property_files_folder_id IS NULL THEN
    SELECT id INTO v_property_files_folder_id
    FROM files
    WHERE path = v_sanitized_name || '/Property_Files' AND type = 'folder/directory';
  END IF;
  
  RETURN QUERY SELECT v_property_folder_id, v_work_orders_folder_id, v_property_files_folder_id;
END;
$$ LANGUAGE plpgsql;

-- Update create_work_order_folder_structure to use sanitized paths
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
  v_sanitized_property text;
BEGIN
  BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found and no users available in auth.users table';
  END IF;
  
  -- Sanitize property name and format work order name
  v_sanitized_property := sanitize_for_storage(p_property_name);
  v_wo_name := 'WO-' || LPAD(p_work_order_num::text, 6, '0');
  
  -- Get Work Orders folder ID using robust lookup
  SELECT id INTO v_work_orders_folder_id
  FROM files
  WHERE property_id = p_property_id 
    AND name = 'Work Orders' 
    AND type = 'folder/directory'
    AND folder_id IS NOT NULL;
  
  IF v_work_orders_folder_id IS NULL THEN
    SELECT id INTO v_work_orders_folder_id
    FROM files
    WHERE path LIKE '%/Work_Orders' 
      AND property_id = p_property_id 
      AND type = 'folder/directory';
  END IF;
  
  IF v_work_orders_folder_id IS NULL THEN
    PERFORM create_property_folder_structure(p_property_id, p_property_name);
    
    SELECT id INTO v_work_orders_folder_id
    FROM files
    WHERE property_id = p_property_id 
      AND name = 'Work Orders' 
      AND type = 'folder/directory'
      AND folder_id IS NOT NULL;
  END IF;
  
  IF v_work_orders_folder_id IS NULL THEN
    RAISE EXCEPTION 'Work Orders folder not found for property: % (ID: %)', p_property_name, p_property_id;
  END IF;
  
  -- Create work order folder
  INSERT INTO files (
    name, path, type, uploaded_by, property_id, job_id, folder_id, size
  ) VALUES (
    v_wo_name,
    v_sanitized_property || '/Work_Orders/' || v_wo_name,
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
  
  IF v_wo_folder_id IS NULL THEN
    SELECT id INTO v_wo_folder_id
    FROM files
    WHERE path = v_sanitized_property || '/Work_Orders/' || v_wo_name AND type = 'folder/directory';
  END IF;
  
  -- Create Before Images folder
  INSERT INTO files (
    name, path, type, uploaded_by, property_id, job_id, folder_id, size
  ) VALUES (
    'Before Images',
    v_sanitized_property || '/Work_Orders/' || v_wo_name || '/Before_Images',
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
  
  IF v_before_images_folder_id IS NULL THEN
    SELECT id INTO v_before_images_folder_id
    FROM files
    WHERE path = v_sanitized_property || '/Work_Orders/' || v_wo_name || '/Before_Images' AND type = 'folder/directory';
  END IF;
  
  -- Create Sprinkler Images folder
  INSERT INTO files (
    name, path, type, uploaded_by, property_id, job_id, folder_id, size
  ) VALUES (
    'Sprinkler Images',
    v_sanitized_property || '/Work_Orders/' || v_wo_name || '/Sprinkler_Images',
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
  
  IF v_sprinkler_images_folder_id IS NULL THEN
    SELECT id INTO v_sprinkler_images_folder_id
    FROM files
    WHERE path = v_sanitized_property || '/Work_Orders/' || v_wo_name || '/Sprinkler_Images' AND type = 'folder/directory';
  END IF;
  
  -- Create Other Files folder
  INSERT INTO files (
    name, path, type, uploaded_by, property_id, job_id, folder_id, size
  ) VALUES (
    'Other Files',
    v_sanitized_property || '/Work_Orders/' || v_wo_name || '/Other_Files',
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
  
  IF v_other_files_folder_id IS NULL THEN
    SELECT id INTO v_other_files_folder_id
    FROM files
    WHERE path = v_sanitized_property || '/Work_Orders/' || v_wo_name || '/Other_Files' AND type = 'folder/directory';
  END IF;
  
  RETURN QUERY SELECT v_wo_folder_id, v_before_images_folder_id, v_sprinkler_images_folder_id, v_other_files_folder_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION sanitize_for_storage(text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_property_folder_structure(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_work_order_folder_structure(uuid, text, text, uuid) TO authenticated;

SELECT 'Folder structure functions updated with consistent path sanitization' as status;
