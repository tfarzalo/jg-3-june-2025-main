-- Migration to restructure file system with Properties and JG Docs and Info folders
-- Date: 2025-12-22

-- 1. Create the new root folders
DO $$
DECLARE
  v_properties_id uuid;
  v_docs_id uuid;
  v_system_user_id uuid;
BEGIN
  -- Get a user ID for 'uploaded_by' (fallback to first user)
  SELECT id INTO v_system_user_id FROM auth.users LIMIT 1;
  IF v_system_user_id IS NULL THEN
     RAISE NOTICE 'No users found, cannot set uploaded_by. Migration might fail constraint.';
  END IF;

  -- Create 'Properties' folder
  INSERT INTO files (name, path, type, uploaded_by, folder_id, size)
  VALUES ('Properties', '/Properties', 'folder/directory', v_system_user_id, NULL, 0)
  ON CONFLICT (path) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_properties_id;

  -- Create 'JG Docs and Info' folder
  INSERT INTO files (name, path, type, uploaded_by, folder_id, size)
  VALUES ('JG Docs and Info', '/JG Docs and Info', 'folder/directory', v_system_user_id, NULL, 0)
  ON CONFLICT (path) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_docs_id;

  -- 2. Move existing Property Folders to 'Properties'
  -- We identify property folders by having property_id set and being at root
  UPDATE files
  SET folder_id = v_properties_id
  WHERE folder_id IS NULL
    AND type = 'folder/directory'
    AND id != v_properties_id
    AND id != v_docs_id
    AND property_id IS NOT NULL;

  -- 3. Move all other root items to 'JG Docs and Info'
  -- This catches manual uploads or other folders not linked to properties
  UPDATE files
  SET folder_id = v_docs_id
  WHERE folder_id IS NULL
    AND id != v_properties_id
    AND id != v_docs_id;

END $$;

-- 4. Update the create_property_folder_structure function to use the Properties folder
CREATE OR REPLACE FUNCTION create_property_folder_structure(p_property_id uuid, p_property_name text)
RETURNS TABLE(
  property_folder_id uuid,
  work_orders_folder_id uuid,
  property_files_folder_id uuid
) AS $$
DECLARE
  v_root_properties_id uuid;
  v_property_folder_id uuid;
  v_work_orders_folder_id uuid;
  v_property_files_folder_id uuid;
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
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;

  -- Get or Create the 'Properties' root folder
  SELECT id INTO v_root_properties_id FROM files WHERE path = '/Properties' AND type = 'folder/directory';
  
  IF v_root_properties_id IS NULL THEN
    INSERT INTO files (name, path, type, uploaded_by, folder_id, size)
    VALUES ('Properties', '/Properties', 'folder/directory', v_user_id, NULL, 0)
    RETURNING id INTO v_root_properties_id;
  END IF;
  
  -- Create or get property folder (Now parented by v_root_properties_id)
  -- Note: We keep the path as /PropertyName for storage compatibility, but change logical parent
  INSERT INTO files (
    name, path, type, uploaded_by, property_id, folder_id, size
  ) VALUES (
    p_property_name,
    '/' || p_property_name, -- Keep legacy storage path mapping
    'folder/directory',
    v_user_id,
    p_property_id,
    v_root_properties_id, -- Set parent to Properties folder
    0
  )
  ON CONFLICT (path) DO UPDATE SET
    folder_id = v_root_properties_id, -- Ensure it moves to Properties if it exists
    name = EXCLUDED.name,
    property_id = EXCLUDED.property_id
  RETURNING id INTO v_property_folder_id;
  
  -- Get property folder ID if it already existed (fallback)
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
    folder_id = v_property_folder_id,
    property_id = EXCLUDED.property_id
  RETURNING id INTO v_work_orders_folder_id;
  
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
    folder_id = v_property_folder_id,
    property_id = EXCLUDED.property_id
  RETURNING id INTO v_property_files_folder_id;
  
  IF v_property_files_folder_id IS NULL THEN
    SELECT id INTO v_property_files_folder_id
    FROM files
    WHERE path = '/' || p_property_name || '/Property Files' AND type = 'folder/directory';
  END IF;
  
  RETURN QUERY SELECT v_property_folder_id, v_work_orders_folder_id, v_property_files_folder_id;
END;
$$ LANGUAGE plpgsql;
