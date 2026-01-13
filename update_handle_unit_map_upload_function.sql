-- Update the handle_unit_map_upload function to be more robust
-- This function will handle cases where the property asset folder doesn't exist yet

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
  v_root_folder_id uuid;
BEGIN
  -- Get the property name
  SELECT property_name INTO v_property_name
  FROM properties
  WHERE id = p_property_id;
  
  IF v_property_name IS NULL THEN
    RAISE EXCEPTION 'Property not found with ID: %', p_property_id;
  END IF;

  -- Get the property's asset folder ID
  SELECT id INTO v_property_folder_id
  FROM files 
  WHERE property_id = p_property_id 
  AND path = '/Property Assets/' || v_property_name
  AND type = 'folder/directory'
  LIMIT 1;

  -- If folder doesn't exist, create it
  IF v_property_folder_id IS NULL THEN
    -- Get the root Property Assets folder
    SELECT id INTO v_root_folder_id
    FROM files 
    WHERE path = '/Property Assets' 
    AND type = 'folder/directory'
    LIMIT 1;

    IF v_root_folder_id IS NULL THEN
      RAISE EXCEPTION 'Property Assets root folder not found';
    END IF;

    -- Create the property asset folder
    INSERT INTO files (name, path, type, uploaded_by, property_id, folder_id, size, job_id)
    VALUES (
      v_property_name || ' Assets',
      '/Property Assets/' || v_property_name,
      'folder/directory',
      p_uploaded_by,
      p_property_id,
      v_root_folder_id,
      0,
      NULL
    )
    RETURNING id INTO v_property_folder_id;

    RAISE NOTICE 'Created property asset folder for "%" with ID: %', v_property_name, v_property_folder_id;
  END IF;

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

  -- Update the property to reference this file
  UPDATE properties 
  SET 
    unit_map_file_id = v_file_id,
    unit_map_file_path = p_file_path
  WHERE id = p_property_id;

  RETURN v_file_id;
END;
$$ LANGUAGE plpgsql;
