/*
  # Simple Fix for Unit Map Upload Function

  Instead of trying to create new sanitized folders (which causes constraint conflicts),
  this migration simply updates the handle_unit_map_upload function to use sanitized
  file paths while working with existing folder structures.

  1. Changes
    - Update handle_unit_map_upload to sanitize file paths only
    - Keep existing folder structure intact
    - Use "Property_Files" in the path instead of "Property Files"
*/

-- Drop and recreate the handle_unit_map_upload function with sanitized paths only
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
  v_sanitized_property_name text;
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
  
  -- Sanitize property name to avoid spaces and special characters
  v_sanitized_property_name := regexp_replace(v_property_name, '[^a-zA-Z0-9\-_]', '_', 'g');
  
  -- Find existing Property Files folder (try both sanitized and original names)
  SELECT id INTO v_property_files_folder_id
  FROM files
  WHERE (
    path = '/' || v_sanitized_property_name || '/Property_Files' 
    OR path = '/' || v_property_name || '/Property Files'
    OR path = '/' || v_sanitized_property_name || '/Property Files'
  ) AND type = 'folder/directory'
  ORDER BY 
    CASE 
      WHEN path = '/' || v_sanitized_property_name || '/Property_Files' THEN 1
      WHEN path = '/' || v_sanitized_property_name || '/Property Files' THEN 2
      WHEN path = '/' || v_property_name || '/Property Files' THEN 3
      ELSE 4
    END
  LIMIT 1;
  
  -- If no Property Files folder found, create it with sanitized name
  IF v_property_files_folder_id IS NULL THEN
    -- First ensure the property root folder exists
    INSERT INTO files (
      name, path, type, uploaded_by, property_id, size
    ) VALUES (
      v_sanitized_property_name,
      '/' || v_sanitized_property_name,
      'folder/directory',
      v_user_id,
      p_property_id,
      0
    )
    ON CONFLICT (path) DO NOTHING;
    
    -- Get the property folder ID
    SELECT id INTO v_property_files_folder_id
    FROM files
    WHERE path = '/' || v_sanitized_property_name AND type = 'folder/directory';
    
    -- Create Property Files folder
    INSERT INTO files (
      name, path, type, uploaded_by, property_id, folder_id, size
    ) VALUES (
      'Property_Files',
      '/' || v_sanitized_property_name || '/Property_Files',
      'folder/directory',
      v_user_id,
      p_property_id,
      v_property_files_folder_id,
      0
    )
    ON CONFLICT (path) DO NOTHING
    RETURNING id INTO v_property_files_folder_id;
    
    -- Get the folder ID if it already existed
    IF v_property_files_folder_id IS NULL THEN
      SELECT id INTO v_property_files_folder_id
      FROM files
      WHERE path = '/' || v_sanitized_property_name || '/Property_Files' AND type = 'folder/directory';
    END IF;
  END IF;
  
  -- Create storage path using sanitized property name
  v_storage_path := v_sanitized_property_name || '/Property_Files/unit-map-' || extract(epoch from now())::text || '-' || p_file_name;
  
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

-- Add comment for documentation
COMMENT ON FUNCTION handle_unit_map_upload IS 'Handles unit map file uploads with sanitized file paths to avoid spaces in storage URLs';
