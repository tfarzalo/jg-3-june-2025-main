-- Comprehensive File Management System Fix
-- This migration implements the complete file management system with proper folder structure
-- Date: 2025-01-15

-- Step 1: Clean up existing folder structure and ensure proper organization
-- First, let's create a function to clean up orphaned files
CREATE OR REPLACE FUNCTION cleanup_orphaned_files()
RETURNS void AS $$
DECLARE
  v_file_record RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Find files that are not in any folder and not property unit maps
  FOR v_file_record IN 
    SELECT f.id, f.name, f.path, f.type
    FROM files f
    WHERE f.folder_id IS NULL 
      AND f.type NOT LIKE 'folder/%'
      AND f.path NOT LIKE 'Property Assets/%'
      AND f.path NOT LIKE '%/Property Files/%'
      AND f.path NOT LIKE '%/Work Orders/%'
  LOOP
    -- Delete the file record
    DELETE FROM files WHERE id = v_file_record.id;
    v_count := v_count + 1;
    
    -- Also try to delete from storage (this might fail if file doesn't exist)
    BEGIN
      PERFORM storage.objects_delete('files', ARRAY[v_file_record.path]);
    EXCEPTION WHEN OTHERS THEN
      -- Ignore storage deletion errors
      NULL;
    END;
  END LOOP;
  
  RAISE NOTICE 'Cleaned up % orphaned files', v_count;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create comprehensive folder structure function
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS create_property_folder_structure(uuid,text);

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
  
  -- Create or get property folder
  INSERT INTO files (
    name, path, type, uploaded_by, property_id, folder_id, size
  ) VALUES (
    p_property_name,
    '/' || p_property_name,
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
  
  -- Get property folder ID if it already existed
  IF v_property_folder_id IS NULL THEN
    SELECT id INTO v_property_folder_id
    FROM files
    WHERE path = '/' || p_property_name AND type = 'folder/directory';
  END IF;
  
  -- Create or get Work Orders folder
  INSERT INTO files (
    name, path, type, uploaded_by, property_id, folder_id, size
  ) VALUES (
    'Work Orders',
    '/' || p_property_name || '/Work Orders',
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
  
  -- Get Work Orders folder ID if it already existed
  IF v_work_orders_folder_id IS NULL THEN
    SELECT id INTO v_work_orders_folder_id
    FROM files
    WHERE path = '/' || p_property_name || '/Work Orders' AND type = 'folder/directory';
  END IF;
  
  -- Create or get Property Files folder
  INSERT INTO files (
    name, path, type, uploaded_by, property_id, folder_id, size
  ) VALUES (
    'Property Files',
    '/' || p_property_name || '/Property Files',
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
  
  -- Get Property Files folder ID if it already existed
  IF v_property_files_folder_id IS NULL THEN
    SELECT id INTO v_property_files_folder_id
    FROM files
    WHERE path = '/' || p_property_name || '/Property Files' AND type = 'folder/directory';
  END IF;
  
  RETURN QUERY SELECT v_property_folder_id, v_work_orders_folder_id, v_property_files_folder_id;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create work order folder structure function
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS create_work_order_folder_structure(uuid,text,text,uuid);

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

-- Step 4: Update unit map upload function to use Property Files folder
-- First drop the existing function if it exists
DROP FUNCTION IF EXISTS handle_unit_map_upload(uuid,text,text,bigint,text,uuid);

CREATE OR REPLACE FUNCTION handle_unit_map_upload(
  p_property_id uuid,
  p_file_name text,
  p_file_path text,
  p_file_size bigint,
  p_file_type text,
  p_uploaded_by uuid
)
RETURNS TABLE(
  file_id uuid,
  file_path text
) AS $$
DECLARE
  v_property_name text;
  v_property_files_folder_id uuid;
  v_file_id uuid;
  v_storage_path text;
  v_user_id uuid;
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
  
  -- Get property name
  SELECT property_name INTO v_property_name
  FROM properties
  WHERE id = p_property_id;
  
  IF v_property_name IS NULL THEN
    RAISE EXCEPTION 'Property not found: %', p_property_id;
  END IF;
  
  -- Ensure property folder structure exists
  PERFORM create_property_folder_structure(p_property_id, v_property_name);
  
  -- Get Property Files folder ID
  SELECT id INTO v_property_files_folder_id
  FROM files
  WHERE path = '/' || v_property_name || '/Property Files' AND type = 'folder/directory';
  
  -- Create storage path
  v_storage_path := v_property_name || '/Property Files/unit-map-' || extract(epoch from now())::text || '-' || p_file_name;
  
  -- Create file record
  INSERT INTO files (
    name, path, size, type, uploaded_by, property_id, folder_id
  ) VALUES (
    p_file_name,
    v_storage_path,
    p_file_size,
    p_file_type,
    v_user_id,
    p_property_id,
    v_property_files_folder_id
  )
  RETURNING id INTO v_file_id;
  
  -- Update property with file reference
  UPDATE properties
  SET 
    unit_map_file_id = v_file_id,
    unit_map_file_path = v_storage_path
  WHERE id = p_property_id;
  
  RETURN QUERY SELECT v_file_id, v_storage_path;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to auto-create property folders
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS trigger_create_property_folders();

CREATE OR REPLACE FUNCTION trigger_create_property_folders()
RETURNS TRIGGER AS $$
BEGIN
  -- Create property folder structure when a new property is created
  PERFORM create_property_folder_structure(NEW.id, NEW.property_name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS create_property_folders_trigger ON properties;

-- Create new trigger
CREATE TRIGGER create_property_folders_trigger
  AFTER INSERT ON properties
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_property_folders();

-- Step 6: Create trigger to auto-create work order folders
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS trigger_create_work_order_folders();

CREATE OR REPLACE FUNCTION trigger_create_work_order_folders()
RETURNS TRIGGER AS $$
DECLARE
  v_property_name text;
  v_work_order_num text;
BEGIN
  -- Get property name and work order number
  SELECT 
    p.property_name,
    j.work_order_num
  INTO 
    v_property_name,
    v_work_order_num
  FROM jobs j
  JOIN properties p ON p.id = j.property_id
  WHERE j.id = NEW.job_id;
  
  -- Create work order folder structure
  PERFORM create_work_order_folder_structure(
    j.property_id,
    v_property_name,
    v_work_order_num::text,
    NEW.job_id
  )
  FROM jobs j
  WHERE j.id = NEW.job_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS create_work_order_folders_trigger ON work_orders;

-- Create new trigger
CREATE TRIGGER create_work_order_folders_trigger
  AFTER INSERT ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_work_order_folders();

-- Step 7: Create function to get proper folder for file uploads
-- Drop existing function if it exists
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
      v_work_order_num,
      p_job_id
    );
    
    SELECT id INTO v_folder_id
    FROM files
    WHERE path = v_folder_path AND type = 'folder/directory';
  END IF;
  
  RETURN v_folder_id;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create folders for all existing properties
DO $$
DECLARE
  v_property RECORD;
  v_user_count INTEGER;
BEGIN
  -- Check if there are users in auth.users table
  SELECT COUNT(*) INTO v_user_count FROM auth.users;
  IF v_user_count = 0 THEN
    RAISE EXCEPTION 'No users found in auth.users table. Please ensure you have at least one authenticated user before running this migration.';
  END IF;
  
  FOR v_property IN 
    SELECT id, property_name FROM properties
  LOOP
    PERFORM create_property_folder_structure(v_property.id, v_property.property_name);
  END LOOP;
END $$;

-- Step 9: Create work order folders for all existing work orders
DO $$
DECLARE
  v_work_order RECORD;
  v_property_name text;
  v_user_count INTEGER;
BEGIN
  -- Check if there are users in auth.users table
  SELECT COUNT(*) INTO v_user_count FROM auth.users;
  IF v_user_count = 0 THEN
    RAISE EXCEPTION 'No users found in auth.users table. Please ensure you have at least one authenticated user before running this migration.';
  END IF;
  
  FOR v_work_order IN 
    SELECT wo.id, wo.job_id, j.work_order_num, j.property_id
    FROM work_orders wo
    JOIN jobs j ON j.id = wo.job_id
  LOOP
    -- Get property name
    SELECT property_name INTO v_property_name
    FROM properties
    WHERE id = v_work_order.property_id;
    
    -- Create work order folder structure
    PERFORM create_work_order_folder_structure(
      v_work_order.property_id,
      v_property_name,
      v_work_order.work_order_num::text,
      v_work_order.job_id
    );
  END LOOP;
END $$;

-- Step 10: Move existing unit map files to Property Files folder
DO $$
DECLARE
  v_property RECORD;
  v_property_files_folder_id uuid;
  v_new_path text;
BEGIN
  FOR v_property IN 
    SELECT id, property_name, unit_map_file_path
    FROM properties
    WHERE unit_map_file_path IS NOT NULL
  LOOP
    -- Get Property Files folder ID
    SELECT id INTO v_property_files_folder_id
    FROM files
    WHERE path = '/' || v_property.property_name || '/Property Files' AND type = 'folder/directory';
    
    IF v_property_files_folder_id IS NOT NULL THEN
      -- Update file record to point to Property Files folder
      UPDATE files
      SET 
        folder_id = v_property_files_folder_id,
        path = v_property.property_name || '/Property Files/' || name
      WHERE property_id = v_property.id 
        AND name LIKE '%unit-map%';
      
      -- Update property with new path
      v_new_path := v_property.property_name || '/Property Files/' || (
        SELECT name FROM files 
        WHERE property_id = v_property.id AND name LIKE '%unit-map%' 
        LIMIT 1
      );
      
      UPDATE properties
      SET unit_map_file_path = v_new_path
      WHERE id = v_property.id;
    END IF;
  END LOOP;
END $$;

-- Step 11: Clean up orphaned files
SELECT cleanup_orphaned_files();

-- Step 12: Add comments
COMMENT ON FUNCTION create_property_folder_structure IS 'Creates the standard property folder structure with Work Orders and Property Files subfolders';
COMMENT ON FUNCTION create_work_order_folder_structure IS 'Creates the work order folder structure with Before Images, Sprinkler Images, and Other Files subfolders';
COMMENT ON FUNCTION get_upload_folder IS 'Returns the appropriate folder ID for file uploads based on property, job, and folder type';
COMMENT ON FUNCTION cleanup_orphaned_files IS 'Removes files that are not properly organized in the folder structure';

-- Step 13: Update RLS policies to allow folder creation
DROP POLICY IF EXISTS "Allow folder creation" ON files;
CREATE POLICY "Allow folder creation" ON files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    type = 'folder/directory' OR 
    (folder_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM files f WHERE f.id = files.folder_id
    ))
  );

-- Step 14: Create function to allow user-created folders
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS create_user_folder(text,uuid);

CREATE OR REPLACE FUNCTION create_user_folder(
  p_name text,
  p_parent_folder_id uuid DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  v_folder_id uuid;
  v_folder_path text;
  v_user_id uuid;
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
  
  -- Build folder path
  IF p_parent_folder_id IS NULL THEN
    v_folder_path := '/' || p_name;
  ELSE
    SELECT path INTO v_folder_path FROM files WHERE id = p_parent_folder_id;
    v_folder_path := v_folder_path || '/' || p_name;
  END IF;
  
  -- Create folder
  INSERT INTO files (
    name, path, type, uploaded_by, folder_id, size
  ) VALUES (
    p_name,
    v_folder_path,
    'folder/directory',
    v_user_id,
    p_parent_folder_id,
    0
  )
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    uploaded_by = EXCLUDED.uploaded_by,
    folder_id = EXCLUDED.folder_id
  RETURNING id INTO v_folder_id;
  
  -- Get folder ID if it already existed
  IF v_folder_id IS NULL THEN
    SELECT id INTO v_folder_id
    FROM files
    WHERE path = v_folder_path AND type = 'folder/directory';
  END IF;
  
  RETURN v_folder_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_user_folder IS 'Allows users to create custom folders for general file storage';

-- Final step: Create a view for easy file browsing
-- Drop existing view if it exists
DROP VIEW IF EXISTS file_browser;

CREATE OR REPLACE VIEW file_browser AS
SELECT 
  f.id,
  f.name,
  f.path,
  f.type,
  f.size,
  f.created_at,
  f.uploaded_by,
  f.property_id,
  f.job_id,
  f.folder_id,
  p.property_name,
  j.work_order_num,
  CASE 
    WHEN f.type LIKE 'folder/%' THEN 'folder'
    WHEN f.type LIKE 'image/%' THEN 'image'
    WHEN f.type LIKE 'video/%' THEN 'video'
    WHEN f.type LIKE 'audio/%' THEN 'audio'
    WHEN f.type LIKE 'application/pdf' THEN 'pdf'
    WHEN f.type LIKE 'application/zip' OR f.type LIKE 'application/x-rar' THEN 'archive'
    ELSE 'file'
  END as file_category
FROM files f
LEFT JOIN properties p ON p.id = f.property_id
LEFT JOIN jobs j ON j.id = f.job_id;

COMMENT ON VIEW file_browser IS 'Comprehensive view for file browsing with property and job information';
