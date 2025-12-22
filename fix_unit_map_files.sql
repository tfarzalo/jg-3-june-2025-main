-- Fix Unit Map Files - Move from Property Assets to Property Files
-- This script moves the remaining unit map files to the proper folder structure

-- Step 1: Create a function to move unit map files to Property Files folder
CREATE OR REPLACE FUNCTION move_unit_map_to_property_files()
RETURNS TABLE(
  moved_count INTEGER,
  errors INTEGER,
  details TEXT[]
) AS $$
DECLARE
  v_property RECORD;
  v_property_files_folder_id uuid;
  v_new_path text;
  v_moved_count INTEGER := 0;
  v_errors INTEGER := 0;
  v_details TEXT[] := ARRAY[]::TEXT[];
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
  
  -- Find unit map files that are still in Property Assets folder
  FOR v_property IN 
    SELECT 
      p.id as property_id,
      p.property_name,
      p.unit_map_file_id,
      p.unit_map_file_path,
      f.name as file_name
    FROM properties p
    JOIN files f ON f.id = p.unit_map_file_id
    WHERE p.unit_map_file_path LIKE 'Property Assets/%'
      AND p.unit_map_file_id IS NOT NULL
  LOOP
    BEGIN
      -- Ensure property folder structure exists
      PERFORM create_property_folder_structure(v_property.property_id, v_property.property_name);
      
      -- Get Property Files folder ID
      SELECT id INTO v_property_files_folder_id
      FROM files
      WHERE path = '/' || v_property.property_name || '/Property Files' 
        AND type = 'folder/directory';
      
      IF v_property_files_folder_id IS NOT NULL THEN
        -- Create new path in Property Files folder
        v_new_path := v_property.property_name || '/Property Files/' || v_property.file_name;
        
        -- Update file record to point to Property Files folder
        UPDATE files
        SET 
          folder_id = v_property_files_folder_id,
          path = v_new_path
        WHERE id = v_property.unit_map_file_id;
        
        -- Update property with new path
        UPDATE properties
        SET unit_map_file_path = v_new_path
        WHERE id = v_property.property_id;
        
        v_moved_count := v_moved_count + 1;
        v_details := array_append(v_details, 'Moved unit map: ' || v_property.file_name || ' to Property Files folder');
        
      ELSE
        v_errors := v_errors + 1;
        v_details := array_append(v_details, 'Error: Property Files folder not found for ' || v_property.property_name);
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      v_details := array_append(v_details, 'Error moving ' || v_property.file_name || ': ' || SQLERRM);
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_moved_count, v_errors, v_details;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Run the function to move unit map files
SELECT * FROM move_unit_map_to_property_files();

-- Step 3: Verify the results
SELECT 
  'Unit Map Files Status' as category,
  COUNT(*) as count
FROM properties 
WHERE unit_map_file_path IS NOT NULL 
  AND unit_map_file_path LIKE '%/Property Files/%'

UNION ALL

SELECT 
  'Unit Map Files in Old Structure' as category,
  COUNT(*) as count
FROM properties 
WHERE unit_map_file_path IS NOT NULL 
  AND unit_map_file_path LIKE 'Property Assets/%';

-- Step 4: Show the updated unit map file paths
SELECT 
  p.property_name,
  p.unit_map_file_path,
  f.name as file_name,
  f.path as file_path
FROM properties p
LEFT JOIN files f ON f.id = p.unit_map_file_id
WHERE p.unit_map_file_path IS NOT NULL
ORDER BY p.property_name;

-- Step 5: Check for any remaining orphaned files
SELECT * FROM identify_orphaned_files();

-- Step 6: Clean up the function
DROP FUNCTION IF EXISTS move_unit_map_to_property_files();

-- Comments
COMMENT ON FUNCTION move_unit_map_to_property_files IS 'Moves unit map files from Property Assets to Property Files folder structure';
