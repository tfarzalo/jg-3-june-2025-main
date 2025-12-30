/*
  Final Fix Properties Structure V2 (Recursive Merge)
  
  This script fixes the folder structure by safely merging duplicate folders.
  It handles the "duplicate key value violates unique constraint" error by:
  1. Defining a recursive merge function.
  2. Merging contents when folders collide.
  3. Renaming files when files collide.
*/

-- 1. Create a helper function to merge contents of one folder into another
CREATE OR REPLACE FUNCTION util_merge_folder_contents(p_source_folder_id uuid, p_target_folder_id uuid)
RETURNS void AS $$
DECLARE
  v_source_child RECORD;
  v_target_child_id uuid;
  v_target_path text;
  v_new_path text;
  v_new_name text;
BEGIN
  -- Get the path of the target folder
  SELECT path INTO v_target_path FROM files WHERE id = p_target_folder_id;
  
  -- Loop through all children of the source folder
  FOR v_source_child IN 
    SELECT * FROM files WHERE folder_id = p_source_folder_id
  LOOP
    
    -- Check if a child with the same name exists in the target folder
    SELECT id INTO v_target_child_id 
    FROM files 
    WHERE folder_id = p_target_folder_id AND name = v_source_child.name;
    
    IF v_target_child_id IS NOT NULL THEN
      ----------------------------------------------------------------
      -- COLLISION DETECTED
      ----------------------------------------------------------------
      
      -- Case A: Both are folders -> RECURSIVE MERGE
      IF (v_source_child.type = 'folder/directory' OR v_source_child.type = 'folder/job' OR v_source_child.type = 'folder/property') 
         AND EXISTS (SELECT 1 FROM files WHERE id = v_target_child_id AND (type LIKE 'folder%')) THEN
         
        RAISE NOTICE 'Merging folder % into existing folder...', v_source_child.name;
        PERFORM util_merge_folder_contents(v_source_child.id, v_target_child_id);
        
        -- After merging contents, delete the now-empty source folder
        DELETE FROM files WHERE id = v_source_child.id;
        
      -- Case B: File collision or Type Mismatch -> RENAME AND MOVE
      ELSE
        v_new_name := v_source_child.name || ' (merged ' || extract(epoch from now())::int || ')';
        v_new_path := v_target_path || '/' || v_new_name;
        
        RAISE NOTICE 'Collision for %. Renaming to %', v_source_child.name, v_new_name;
        
        UPDATE files 
        SET folder_id = p_target_folder_id,
            name = v_new_name,
            path = v_new_path
        WHERE id = v_source_child.id;
        
        -- Update descendants (if it was a folder renamed)
        UPDATE files
        SET path = v_new_path || SUBSTRING(path FROM LENGTH(v_source_child.path) + 1)
        WHERE path LIKE v_source_child.path || '/%';
      END IF;
      
    ELSE
      ----------------------------------------------------------------
      -- NO COLLISION -> JUST MOVE
      ----------------------------------------------------------------
      v_new_path := v_target_path || '/' || v_source_child.name;
      
      UPDATE files 
      SET folder_id = p_target_folder_id,
          path = v_new_path
      WHERE id = v_source_child.id;
      
      -- Update descendants
      UPDATE files
      SET path = v_new_path || SUBSTRING(path FROM LENGTH(v_source_child.path) + 1)
      WHERE path LIKE v_source_child.path || '/%';
      
      RAISE NOTICE 'Moved % to %', v_source_child.name, v_target_path;
    END IF;
    
  END LOOP;
END;
$$ LANGUAGE plpgsql;


-- 2. Execute the Main Logic
DO $$
DECLARE
  v_prop RECORD;
  v_properties_root_id uuid;
  v_prop_folder_id uuid;
  v_bad_root_path text;
  v_good_path text;
  v_root_file RECORD;
  v_user_id uuid;
BEGIN
  -- Get system user
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

  -- Ensure /Properties exists
  SELECT id INTO v_properties_root_id FROM files WHERE path = '/Properties' AND type = 'folder/directory';
  IF v_properties_root_id IS NULL THEN
    INSERT INTO files (name, path, type, uploaded_by, size)
    VALUES ('Properties', '/Properties', 'folder/directory', v_user_id, 0)
    RETURNING id INTO v_properties_root_id;
  END IF;

  -- Loop through every property
  FOR v_prop IN SELECT id, property_name FROM properties LOOP
    
    v_bad_root_path := '/' || v_prop.property_name;
    v_good_path := '/Properties/' || v_prop.property_name;

    -- Ensure the Nested Property Folder exists
    SELECT id INTO v_prop_folder_id FROM files WHERE path = v_good_path;
    
    IF v_prop_folder_id IS NULL THEN
      -- Create it
      INSERT INTO files (name, path, folder_id, type, uploaded_by, property_id, size)
      VALUES (
        v_prop.property_name, 
        v_good_path, 
        v_properties_root_id, 
        'folder/property', 
        v_user_id, 
        v_prop.id, 
        0
      )
      RETURNING id INTO v_prop_folder_id;
    END IF;

    -- Find the Bad Root Folder
    SELECT * INTO v_root_file FROM files WHERE path = v_bad_root_path;
    
    IF v_root_file.id IS NOT NULL THEN
      RAISE NOTICE 'Found root folder for %. Merging...', v_prop.property_name;
      
      -- Merge contents of Root Folder into Nested Folder
      PERFORM util_merge_folder_contents(v_root_file.id, v_prop_folder_id);
      
      -- Delete the Root Folder itself (it should be empty now)
      DELETE FROM files WHERE id = v_root_file.id;
    END IF;
      
  END LOOP;
  
  RAISE NOTICE 'Cleanup complete.';
END $$;

-- 3. Cleanup: Drop the helper function
DROP FUNCTION IF EXISTS util_merge_folder_contents(uuid, uuid);
