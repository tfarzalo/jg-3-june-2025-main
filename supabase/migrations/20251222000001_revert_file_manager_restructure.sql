-- Revert Migration for File Manager Restructure
-- This script undoes the changes made by 20251222000000_restructure_file_manager.sql
-- It moves folders back to the root level and deletes the container folders.

DO $$
DECLARE
  v_properties_id uuid;
  v_docs_id uuid;
BEGIN
  -- 1. Find the container folders
  SELECT id INTO v_properties_id FROM files WHERE path = '/Properties' AND type = 'folder/directory';
  SELECT id INTO v_docs_id FROM files WHERE path = '/JG Docs and Info' AND type = 'folder/directory';

  -- 2. Move items out of 'Properties' folder back to root
  IF v_properties_id IS NOT NULL THEN
    UPDATE files
    SET folder_id = NULL
    WHERE folder_id = v_properties_id;
  END IF;

  -- 3. Move items out of 'JG Docs and Info' folder back to root
  IF v_docs_id IS NOT NULL THEN
    UPDATE files
    SET folder_id = NULL
    WHERE folder_id = v_docs_id;
  END IF;

  -- 4. Delete the container folders
  IF v_properties_id IS NOT NULL THEN
    DELETE FROM files WHERE id = v_properties_id;
  END IF;

  IF v_docs_id IS NOT NULL THEN
    DELETE FROM files WHERE id = v_docs_id;
  END IF;

END $$;

-- 5. Restore the original create_property_folder_structure function
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
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;
  
  -- Create or get property folder (At Root Level)
  INSERT INTO files (
    name, path, type, uploaded_by, property_id, folder_id, size
  ) VALUES (
    p_property_name,
    '/' || p_property_name,
    'folder/directory',
    v_user_id,
    p_property_id,
    NULL, -- Back to NULL (Root)
    0
  )
  ON CONFLICT (path) DO UPDATE SET
    folder_id = NULL, -- Ensure it is at root
    name = EXCLUDED.name,
    property_id = EXCLUDED.property_id
  RETURNING id INTO v_property_folder_id;
  
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
