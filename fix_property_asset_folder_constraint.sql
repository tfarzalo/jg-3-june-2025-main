-- Fix Property Asset Folder Constraint Issue
-- This script resolves the "duplicate key value violates unique constraint files_folder_id_name_key" error
-- by properly handling existing folders and using ON CONFLICT clauses

-- First, let's check the current constraint structure
SELECT 
  'Current constraints:' as info,
  conname,
  contype,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'files'::regclass;

-- Check for duplicate folders that might be causing issues
SELECT 
  'Duplicate folders found:' as info,
  folder_id,
  name,
  COUNT(*) as count,
  array_agg(id) as folder_ids
FROM files 
WHERE type = 'folder/directory' 
  AND folder_id IS NOT NULL
GROUP BY folder_id, name 
HAVING COUNT(*) > 1
ORDER BY folder_id, name;

-- Check the Property Assets folder structure
SELECT 
  'Property Assets structure:' as info,
  path,
  name,
  folder_id,
  property_id,
  type
FROM files 
WHERE path LIKE '/Property Assets%'
ORDER BY path;

-- Create a function to safely create property asset folders
CREATE OR REPLACE FUNCTION create_property_asset_folder_safe(
  p_property_id uuid,
  p_property_name text,
  p_user_id uuid
)
RETURNS uuid AS $$
DECLARE
  v_property_assets_folder_id uuid;
  v_property_folder_id uuid;
BEGIN
  -- Get the Property Assets root folder ID
  SELECT id INTO v_property_assets_folder_id
  FROM files 
  WHERE path = '/Property Assets' 
  AND type = 'folder/directory'
  LIMIT 1;
  
  -- If root folder doesn't exist, create it
  IF v_property_assets_folder_id IS NULL THEN
    INSERT INTO files (name, path, type, uploaded_by, folder_id, size, property_id, job_id)
    VALUES (
      'Property Assets',
      '/Property Assets',
      'folder/directory',
      p_user_id,
      NULL,
      0,
      NULL,
      NULL
    )
    ON CONFLICT (path) DO NOTHING
    RETURNING id INTO v_property_assets_folder_id;
    
    -- Get the ID if it was created
    IF v_property_assets_folder_id IS NULL THEN
      SELECT id INTO v_property_assets_folder_id
      FROM files 
      WHERE path = '/Property Assets' 
      AND type = 'folder/directory';
    END IF;
  END IF;

  -- Check if property folder already exists by path (more reliable than name)
  SELECT id INTO v_property_folder_id
  FROM files 
  WHERE path = '/Property Assets/' || p_property_name
  AND type = 'folder/directory'
  LIMIT 1;

  -- If folder doesn't exist, create it
  IF v_property_folder_id IS NULL THEN
    INSERT INTO files (name, path, type, uploaded_by, property_id, folder_id, size, job_id)
    VALUES (
      p_property_name || ' Assets',
      '/Property Assets/' || p_property_name,
      'folder/directory',
      p_user_id,
      p_property_id,
      v_property_assets_folder_id,
      0,
      NULL
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      property_id = EXCLUDED.property_id,
      folder_id = EXCLUDED.folder_id,
      updated_at = now()
    RETURNING id INTO v_property_folder_id;
  END IF;

  RETURN v_property_folder_id;
END;
$$ LANGUAGE plpgsql;

-- Update the handle_unit_map_upload function to use the safe folder creation
CREATE OR REPLACE FUNCTION handle_unit_map_upload(
  p_property_id uuid,
  p_file_name text,
  p_file_path text,
  p_file_size bigint,
  p_file_type text,
  p_uploaded_by uuid
)
RETURNS uuid AS $$
DECLARE
  v_file_id uuid;
  v_property_folder_id uuid;
  v_property_name text;
BEGIN
  -- Get the property name
  SELECT property_name INTO v_property_name
  FROM properties
  WHERE id = p_property_id;
  
  IF v_property_name IS NULL THEN
    RAISE EXCEPTION 'Property not found with ID: %', p_property_id;
  END IF;

  -- Use the safe folder creation function
  v_property_folder_id := create_property_asset_folder_safe(p_property_id, v_property_name, p_uploaded_by);

  -- Create the file record
  INSERT INTO files (name, path, size, type, uploaded_by, property_id, folder_id)
  VALUES (
    p_file_name,
    p_file_path,
    p_file_size,
    p_file_type,
    p_uploaded_by,
    p_property_id,
    v_property_folder_id
  )
  RETURNING id INTO v_file_id;

  -- Update the property with the file reference
  UPDATE properties 
  SET 
    unit_map_file_id = v_file_id,
    unit_map_file_path = p_file_path
  WHERE id = p_property_id;

  RETURN v_file_id;
END;
$$ LANGUAGE plpgsql;

-- Clean up any duplicate folders that might exist
-- This will help prevent future constraint violations
DO $$
DECLARE
  v_duplicate RECORD;
  v_keep_id uuid;
  v_delete_ids uuid[];
BEGIN
  FOR v_duplicate IN 
    SELECT folder_id, name, array_agg(id ORDER BY created_at) as folder_ids
    FROM files 
    WHERE type = 'folder/directory' 
      AND folder_id IS NOT NULL
    GROUP BY folder_id, name 
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the oldest folder, delete the rest
    v_keep_id := v_duplicate.folder_ids[1];
    v_delete_ids := v_duplicate.folder_ids[2:array_length(v_duplicate.folder_ids, 1)];
    
    -- Update any references to point to the kept folder
    UPDATE files 
    SET folder_id = v_keep_id
    WHERE folder_id = ANY(v_delete_ids);
    
    -- Delete the duplicate folders
    DELETE FROM files 
    WHERE id = ANY(v_delete_ids);
    
    RAISE NOTICE 'Cleaned up duplicate folders for %/%: kept %, deleted %', 
      v_duplicate.folder_id, v_duplicate.name, v_keep_id, v_delete_ids;
  END LOOP;
END $$;

-- Verify the fix
SELECT 
  'After fix - Property Assets structure:' as info,
  path,
  name,
  folder_id,
  property_id,
  type
FROM files 
WHERE path LIKE '/Property Assets%'
ORDER BY path;

-- Check for any remaining duplicate constraints
SELECT 
  'Remaining duplicate folders:' as info,
  folder_id,
  name,
  COUNT(*) as count
FROM files 
WHERE type = 'folder/directory' 
  AND folder_id IS NOT NULL
GROUP BY folder_id, name 
HAVING COUNT(*) > 1
ORDER BY folder_id, name;
