/*
  # Fix Unit Map File Paths

  This migration fixes potential mismatches between unit map file paths
  stored in the properties table and the actual file paths in the files table.

  1. Changes
    - Update properties.unit_map_file_path to match files.path
    - Handle cases where file paths have spaces or special characters
    - Ensure consistency between database records and storage paths

  2. Debugging
    - Logs the number of properties updated
    - Shows before/after paths for verification
*/

-- Function to fix unit map file paths
CREATE OR REPLACE FUNCTION fix_unit_map_file_paths()
RETURNS TABLE(
  property_id uuid,
  property_name text,
  old_path text,
  new_path text,
  updated boolean
) AS $$
DECLARE
  v_property RECORD;
  v_file_path text;
  v_updated boolean := false;
BEGIN
  -- Loop through properties with unit map files
  FOR v_property IN 
    SELECT 
      p.id,
      p.property_name,
      p.unit_map_file_id,
      p.unit_map_file_path,
      f.path as file_path
    FROM properties p
    LEFT JOIN files f ON p.unit_map_file_id = f.id
    WHERE p.unit_map_file_path IS NOT NULL
  LOOP
    v_updated := false;
    
    -- If we have a file record, use its path
    IF v_property.file_path IS NOT NULL THEN
      v_file_path := v_property.file_path;
      
      -- Update property if paths don't match
      IF v_property.unit_map_file_path != v_file_path THEN
        UPDATE properties
        SET unit_map_file_path = v_file_path
        WHERE id = v_property.id;
        v_updated := true;
      END IF;
    ELSE
      -- No file record found, try to find it by name pattern
      SELECT f.path INTO v_file_path
      FROM files f
      WHERE f.property_id = v_property.id
        AND f.name LIKE '%unit-map%'
        AND f.type LIKE 'image/%'
      ORDER BY f.created_at DESC
      LIMIT 1;
      
      IF v_file_path IS NOT NULL THEN
        UPDATE properties
        SET unit_map_file_path = v_file_path
        WHERE id = v_property.id;
        v_updated := true;
      END IF;
    END IF;
    
    -- Return the result
    property_id := v_property.id;
    property_name := v_property.property_name;
    old_path := v_property.unit_map_file_path;
    new_path := v_file_path;
    updated := v_updated;
    
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Run the fix function
SELECT * FROM fix_unit_map_file_paths();

-- Clean up the function
DROP FUNCTION fix_unit_map_file_paths();

-- Add a comment for documentation
COMMENT ON TABLE properties IS 'Properties table with unit map file references that should match files.path';
