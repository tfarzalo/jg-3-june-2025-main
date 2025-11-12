-- Fix Unit Map Files - Move from Property Assets to Property Files
-- Simple version without function

-- Step 1: Check current unit map files in Property Assets
SELECT 
  p.property_name,
  p.unit_map_file_path,
  f.name as file_name,
  f.path as file_path
FROM properties p
LEFT JOIN files f ON f.id = p.unit_map_file_id
WHERE p.unit_map_file_path LIKE 'Property Assets/%'
ORDER BY p.property_name;

-- Step 2: Move unit map files to Property Files folder
DO $$
DECLARE
  v_property RECORD;
  v_property_files_folder_id uuid;
  v_new_path text;
  v_moved_count INTEGER := 0;
  v_errors INTEGER := 0;
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
        RAISE NOTICE 'Moved unit map: % to Property Files folder', v_property.file_name;
        
      ELSE
        v_errors := v_errors + 1;
        RAISE NOTICE 'Error: Property Files folder not found for %', v_property.property_name;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      RAISE NOTICE 'Error moving %: %', v_property.file_name, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Moved % unit map files, % errors', v_moved_count, v_errors;
END $$;

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
