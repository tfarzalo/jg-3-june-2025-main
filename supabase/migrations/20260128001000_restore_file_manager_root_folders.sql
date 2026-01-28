-- Restore File Manager root folders and align property folders under Properties (non-destructive)

DO $$
DECLARE
  v_system_user_id uuid;
BEGIN
  -- Get a user ID for uploaded_by (fallback to first user)
  SELECT id INTO v_system_user_id FROM auth.users LIMIT 1;
  IF v_system_user_id IS NULL THEN
    RAISE NOTICE 'No users found, cannot set uploaded_by for root folders.';
  END IF;

  -- Ensure 'Properties' root folder exists
  INSERT INTO files (name, path, storage_path, display_path, type, uploaded_by, folder_id, size)
  VALUES ('Properties', '/Properties', '/Properties', '/Properties', 'folder/directory', v_system_user_id, NULL, 0)
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    display_path = COALESCE(files.display_path, EXCLUDED.display_path),
    storage_path = COALESCE(files.storage_path, EXCLUDED.storage_path);

  -- Ensure 'JG Docs and Info' root folder exists
  INSERT INTO files (name, path, storage_path, display_path, type, uploaded_by, folder_id, size)
  VALUES ('JG Docs and Info', '/JG Docs and Info', '/JG Docs and Info', '/JG Docs and Info', 'folder/directory', v_system_user_id, NULL, 0)
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    display_path = COALESCE(files.display_path, EXCLUDED.display_path),
    storage_path = COALESCE(files.storage_path, EXCLUDED.storage_path);
END $$;

-- Update property folder creation to use the Properties root when present
CREATE OR REPLACE FUNCTION create_property_folder_structure(p_property_id UUID, p_property_name TEXT)
RETURNS TABLE(
  property_folder_id UUID,
  work_orders_folder_id UUID,
  property_files_folder_id UUID
) AS $$
DECLARE
  v_property_folder_id UUID;
  v_work_orders_folder_id UUID;
  v_property_files_folder_id UUID;
  v_user_id UUID;
  v_storage_base TEXT;
  v_display_base TEXT;
  v_properties_root_id UUID;
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

  SELECT id INTO v_properties_root_id
  FROM files
  WHERE name = 'Properties'
    AND folder_id IS NULL
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  v_storage_base := canonical_property_path(p_property_id);
  v_display_base := '/Properties/' || p_property_name;

  -- Property root folder (reuse if exists)
  SELECT id INTO v_property_folder_id
  FROM files
  WHERE property_id = p_property_id
    AND folder_id IS NOT DISTINCT FROM v_properties_root_id
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  IF v_property_folder_id IS NULL THEN
    INSERT INTO files (
      name, path, storage_path, display_path, type, uploaded_by, property_id, folder_id, size
    ) VALUES (
      p_property_name,
      v_storage_base,
      v_storage_base,
      v_display_base,
      'folder/directory',
      v_user_id,
      p_property_id,
      v_properties_root_id,
      0
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      property_id = EXCLUDED.property_id,
      folder_id = EXCLUDED.folder_id,
      display_path = COALESCE(files.display_path, EXCLUDED.display_path),
      storage_path = COALESCE(files.storage_path, EXCLUDED.storage_path)
    RETURNING id INTO v_property_folder_id;
  ELSE
    UPDATE files
    SET
      name = p_property_name,
      display_path = COALESCE(display_path, v_display_base),
      storage_path = COALESCE(storage_path, path)
    WHERE id = v_property_folder_id;
  END IF;

  -- Work Orders folder
  SELECT id INTO v_work_orders_folder_id
  FROM files
  WHERE property_id = p_property_id
    AND name = 'Work Orders'
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  IF v_work_orders_folder_id IS NULL THEN
    INSERT INTO files (
      name, path, storage_path, display_path, type, uploaded_by, property_id, folder_id, size
    ) VALUES (
      'Work Orders',
      v_storage_base || '/work-orders',
      v_storage_base || '/work-orders',
      v_display_base || '/Work Orders',
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
      folder_id = EXCLUDED.folder_id,
      display_path = COALESCE(files.display_path, EXCLUDED.display_path),
      storage_path = COALESCE(files.storage_path, EXCLUDED.storage_path)
    RETURNING id INTO v_work_orders_folder_id;
  ELSE
    UPDATE files
    SET
      display_path = COALESCE(display_path, v_display_base || '/Work Orders'),
      storage_path = COALESCE(storage_path, path)
    WHERE id = v_work_orders_folder_id;
  END IF;

  -- Property Files folder
  SELECT id INTO v_property_files_folder_id
  FROM files
  WHERE property_id = p_property_id
    AND name = 'Property Files'
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  IF v_property_files_folder_id IS NULL THEN
    INSERT INTO files (
      name, path, storage_path, display_path, type, uploaded_by, property_id, folder_id, size
    ) VALUES (
      'Property Files',
      v_storage_base || '/property-files',
      v_storage_base || '/property-files',
      v_display_base || '/Property Files',
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
      folder_id = EXCLUDED.folder_id,
      display_path = COALESCE(files.display_path, EXCLUDED.display_path),
      storage_path = COALESCE(files.storage_path, EXCLUDED.storage_path)
    RETURNING id INTO v_property_files_folder_id;
  ELSE
    UPDATE files
    SET
      display_path = COALESCE(display_path, v_display_base || '/Property Files'),
      storage_path = COALESCE(storage_path, path)
    WHERE id = v_property_files_folder_id;
  END IF;

  RETURN QUERY SELECT v_property_folder_id, v_work_orders_folder_id, v_property_files_folder_id;
END;
$$ LANGUAGE plpgsql;
