/*
  # Clear Broken Unit Map Files

  This migration clears unit map file references that have spaces in their paths,
  which cause 400 errors when accessing the files. This allows users to re-upload
  the unit maps with the correct sanitized paths.

  1. Changes
    - Clear unit_map_file_id and unit_map_file_path for properties with spaces in paths
    - Delete the corresponding file records from the files table
    - This forces a clean re-upload with the correct path format

  2. Note
    - This will remove the broken unit map references
    - Users will need to re-upload their unit map images
    - New uploads will use the sanitized path format
*/

-- Function to clear broken unit map files
CREATE OR REPLACE FUNCTION clear_broken_unit_maps()
RETURNS TABLE(
  property_id uuid,
  property_name text,
  old_file_id uuid,
  old_file_path text,
  cleared boolean
) AS $$
DECLARE
  v_property RECORD;
  v_cleared boolean := false;
BEGIN
  -- Loop through properties with unit map files that have spaces in paths
  FOR v_property IN 
    SELECT 
      p.id,
      p.property_name,
      p.unit_map_file_id,
      p.unit_map_file_path
    FROM properties p
    WHERE p.unit_map_file_path IS NOT NULL
      AND p.unit_map_file_path ~ ' '  -- Contains spaces
  LOOP
    v_cleared := false;
    
    -- Delete the file record if it exists
    IF v_property.unit_map_file_id IS NOT NULL THEN
      DELETE FROM files WHERE id = v_property.unit_map_file_id;
    END IF;
    
    -- Clear the property references
    UPDATE properties
    SET 
      unit_map_file_id = NULL,
      unit_map_file_path = NULL
    WHERE id = v_property.id;
    
    v_cleared := true;
    
    -- Return the result
    property_id := v_property.id;
    property_name := v_property.property_name;
    old_file_id := v_property.unit_map_file_id;
    old_file_path := v_property.unit_map_file_path;
    cleared := v_cleared;
    
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the cleanup function
SELECT * FROM clear_broken_unit_maps();

-- Clean up the function
DROP FUNCTION clear_broken_unit_maps();

-- Show remaining properties with unit maps (should be none with spaces now)
SELECT 
  p.id,
  p.property_name,
  p.unit_map_file_path
FROM properties p
WHERE p.unit_map_file_path IS NOT NULL
ORDER BY p.created_at DESC;
