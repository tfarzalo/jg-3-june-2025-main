/*
  # Fix Spaces in File Paths

  This migration fixes file paths that contain spaces, which cause issues
  with Supabase storage URLs. It updates the database records to use
  underscore-separated paths instead of spaces.

  1. Changes
    - Replace spaces with underscores in file paths
    - Update both files.path and properties.unit_map_file_path
    - Handle the specific case of "1010 Dilworth/Property Files/..." paths

  2. Note
    - This only updates the database records
    - The actual files in storage may need to be moved manually
    - Or the files may need to be re-uploaded with the correct paths
*/

-- Function to sanitize file paths by replacing spaces with underscores
CREATE OR REPLACE FUNCTION sanitize_file_paths()
RETURNS TABLE(
  file_id uuid,
  old_path text,
  new_path text,
  updated boolean
) AS $$
DECLARE
  v_file RECORD;
  v_new_path text;
  v_updated boolean := false;
BEGIN
  -- Loop through files with spaces in their paths
  FOR v_file IN 
    SELECT id, path, name, property_id
    FROM files
    WHERE path ~ ' '  -- Contains spaces
  LOOP
    v_updated := false;
    
    -- Create new path by replacing spaces with underscores
    v_new_path := replace(v_file.path, ' ', '_');
    
    -- Update the file record
    UPDATE files
    SET path = v_new_path
    WHERE id = v_file.id;
    
    v_updated := true;
    
    -- Also update the property's unit_map_file_path if it matches
    UPDATE properties
    SET unit_map_file_path = v_new_path
    WHERE unit_map_file_path = v_file.path;
    
    -- Return the result
    file_id := v_file.id;
    old_path := v_file.path;
    new_path := v_new_path;
    updated := v_updated;
    
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the sanitization function
SELECT * FROM sanitize_file_paths();

-- Clean up the function
DROP FUNCTION sanitize_file_paths();

-- Show the results
SELECT 
  p.property_name,
  p.unit_map_file_path,
  f.path as file_path,
  f.name as file_name
FROM properties p
LEFT JOIN files f ON p.unit_map_file_id = f.id
WHERE p.unit_map_file_path IS NOT NULL
ORDER BY p.created_at DESC;
