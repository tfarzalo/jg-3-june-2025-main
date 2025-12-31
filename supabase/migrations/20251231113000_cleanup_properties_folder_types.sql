DO $$
DECLARE
  v_root_properties_id uuid;
  v_prop RECORD;
BEGIN
  -- Ensure /Properties root exists and has correct type
  SELECT id INTO v_root_properties_id FROM files WHERE path = '/Properties' AND type = 'folder/directory';
  IF v_root_properties_id IS NULL THEN
    INSERT INTO files (name, path, type, uploaded_by, folder_id, size)
    SELECT 'Properties', '/Properties', 'folder/directory', id, NULL, 0
    FROM auth.users LIMIT 1
    RETURNING id INTO v_root_properties_id;
  END IF;

  -- Normalize legacy folder types under /Properties
  UPDATE files
  SET type = 'folder/directory'
  WHERE path LIKE '/Properties/%'
    AND type IN ('folder/property', 'folder/job');

  -- Ensure all property folders and subfolders exist and are parented correctly
  FOR v_prop IN SELECT id, property_name FROM properties LOOP
    PERFORM create_property_folder_structure(v_prop.id, v_prop.property_name);
  END LOOP;

  -- Backfill display_path/storage_path for folders missing them
  UPDATE files
  SET display_path = COALESCE(display_path, path),
      storage_path = COALESCE(storage_path, path)
  WHERE path LIKE '/Properties/%';
END $$;

-- Verification: show any entries under /Properties with non-folder types
SELECT id, name, type, path, folder_id
FROM files
WHERE path LIKE '/Properties/%'
  AND type NOT IN ('folder/directory')
ORDER BY path;
