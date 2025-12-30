/*
  Fix Duplicate Property Folders
  
  This script addresses the issue where duplicate property folders were created at the root level 
  (e.g., "/1010 Dilworth") instead of being inside the "/Properties" folder.
  
  Logic:
  1. Identify property folders at the root level.
  2. Check if a corresponding folder exists inside "/Properties".
  3. If it exists: Move all contents from the root folder to the nested one, then delete the root folder.
  4. If it doesn't exist: Move the root folder itself into "/Properties".
*/

DO $$
DECLARE
  v_root_prop_folder RECORD;
  v_nested_prop_folder_id uuid;
  v_properties_root_id uuid;
  v_child RECORD;
  v_moved_count INTEGER := 0;
  v_merged_count INTEGER := 0;
BEGIN
  -- Get the ID of the main 'Properties' folder
  SELECT id INTO v_properties_root_id FROM files WHERE path = '/Properties' AND type = 'folder/directory';

  -- If 'Properties' folder doesn't exist, we can't proceed safely
  IF v_properties_root_id IS NULL THEN
    RAISE NOTICE 'Critical Error: "/Properties" folder not found. Aborting.';
    RETURN;
  END IF;

  -- Loop through all property folders that are at the root level
  -- We identify them by type='folder/property' and path NOT starting with /Properties
  FOR v_root_prop_folder IN 
    SELECT f.id, f.name, f.path, f.property_id
    FROM files f
    WHERE f.type = 'folder/property'
      AND f.path NOT LIKE '/Properties/%'
      AND f.folder_id IS NULL  -- Or check path depth. Root files usually have null folder_id or point to root? 
                               -- Safest is just path check. But strict root usually means folder_id is null or strict path structure.
      AND f.path = '/' || f.name -- Ensure it is truly at root (e.g. /1010 Dilworth)
  LOOP
    
    -- Check if a correct nested folder exists for this property
    SELECT id INTO v_nested_prop_folder_id
    FROM files
    WHERE property_id = v_root_prop_folder.property_id
      AND type = 'folder/property'
      AND path = '/Properties/' || v_root_prop_folder.name;

    IF v_nested_prop_folder_id IS NOT NULL THEN
      ----------------------------------------------------------------
      -- CASE 1: MERGE (Destination exists)
      ----------------------------------------------------------------
      RAISE NOTICE 'Merging root folder "%" into existing nested folder...', v_root_prop_folder.name;
      
      -- Move all children of the root folder to the nested folder
      FOR v_child IN SELECT id, name, path FROM files WHERE folder_id = v_root_prop_folder.id LOOP
        
        -- Update the child's parent and path
        UPDATE files 
        SET folder_id = v_nested_prop_folder_id,
            path = '/Properties/' || v_root_prop_folder.name || '/' || v_child.name
        WHERE id = v_child.id;
        
        -- Recursively update paths for all descendants of this child
        UPDATE files
        SET path = '/Properties/' || v_root_prop_folder.name || '/' || v_child.name || 
                   SUBSTRING(path FROM LENGTH(v_child.path) + 1)
        WHERE path LIKE v_child.path || '/%';
        
      END LOOP;
      
      -- Delete the now-empty root folder
      DELETE FROM files WHERE id = v_root_prop_folder.id;
      
      v_merged_count := v_merged_count + 1;
      
    ELSE
      ----------------------------------------------------------------
      -- CASE 2: MOVE (Destination does not exist)
      ----------------------------------------------------------------
      RAISE NOTICE 'Moving root folder "%" to Properties...', v_root_prop_folder.name;
      
      -- Move the folder itself
      UPDATE files
      SET folder_id = v_properties_root_id,
          path = '/Properties/' || v_root_prop_folder.name
      WHERE id = v_root_prop_folder.id;
      
      -- Update paths for all descendants
      UPDATE files
      SET path = '/Properties/' || v_root_prop_folder.name || SUBSTRING(path FROM LENGTH(v_root_prop_folder.path) + 1)
      WHERE path LIKE v_root_prop_folder.path || '/%';
      
      v_moved_count := v_moved_count + 1;
      
    END IF;
    
  END LOOP;
  
  RAISE NOTICE 'Summary: Merged % folders, Moved % folders.', v_merged_count, v_moved_count;
  
END $$;
