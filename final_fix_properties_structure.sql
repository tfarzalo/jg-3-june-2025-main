/*
  Final Fix Properties Structure
  
  This script is the "Nuclear Option" to fix the folder structure.
  It assumes the correct structure is:
    /Properties
      /{PropertyName}
        /Work Orders
          /WO-XXXXXX
  
  It will:
  1. Create the /Properties folder if missing.
  2. For EVERY property in the database:
     a. Ensure /Properties/{Name} exists.
     b. Move any file/folder at /{Name} into /Properties/{Name}.
     c. Fix paths of all children.
*/

DO $$
DECLARE
  v_prop RECORD;
  v_properties_root_id uuid;
  v_prop_folder_id uuid;
  v_bad_root_path text;
  v_good_path text;
  v_root_file RECORD;
  v_moved_count INTEGER := 0;
  v_user_id uuid;
BEGIN
  -- 0. Get a user ID for ownership
  SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

  -- 1. Ensure /Properties exists
  SELECT id INTO v_properties_root_id FROM files WHERE path = '/Properties' AND type = 'folder/directory';
  
  IF v_properties_root_id IS NULL THEN
    INSERT INTO files (name, path, type, uploaded_by, size)
    VALUES ('Properties', '/Properties', 'folder/directory', v_user_id, 0)
    RETURNING id INTO v_properties_root_id;
    RAISE NOTICE 'Created /Properties folder.';
  END IF;

  -- 2. Loop through every property
  FOR v_prop IN SELECT id, property_name FROM properties LOOP
    
    v_bad_root_path := '/' || v_prop.property_name;
    v_good_path := '/Properties/' || v_prop.property_name;

    -- 2a. Ensure the Nested Property Folder exists
    SELECT id INTO v_prop_folder_id FROM files WHERE path = v_good_path; -- AND type = 'folder/property'; -- Type might vary
    
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
      RAISE NOTICE 'Created missing folder: %', v_good_path;
    ELSE
      -- Ensure it has the correct parent (in case it was moved but not parented correctly)
      UPDATE files SET folder_id = v_properties_root_id WHERE id = v_prop_folder_id AND folder_id IS DISTINCT FROM v_properties_root_id;
    END IF;

    -- 2b. Find anything at the BAD root path
    -- We look for files/folders that START with the bad path
    -- But we must be careful not to match partial names (e.g. /101 matching /1010)
    -- So we match EXACT path or Path + '/'
    
    -- First, check if the ROOT FOLDER itself exists at the bad location
    FOR v_root_file IN 
      SELECT id, name, path, type 
      FROM files 
      WHERE path = v_bad_root_path
    LOOP
      -- It exists! We need to merge it into the good folder.
      
      -- Move its children first
      UPDATE files 
      SET folder_id = v_prop_folder_id,
          path = v_good_path || '/' || name
      WHERE folder_id = v_root_file.id;
      
      -- Fix grandchildren paths recursively
      -- Note: The children are now at v_good_path/child. Their children need update.
      -- Actually, easier to do path string replacement on EVERYTHING that starts with bad path
      -- excluding the root folder itself (handled above)
      
      -- Let's just DELETE the bad root folder now that we re-parented its immediate children?
      -- No, we need to update the paths of the children first.
      
      -- Let's try a simpler approach: PATH REPLACEMENT for everything under it.
      UPDATE files
      SET path = v_good_path || SUBSTRING(path FROM LENGTH(v_bad_root_path) + 1)
      WHERE path LIKE v_bad_root_path || '/%';
      
      -- Now re-parent the immediate children
      UPDATE files
      SET folder_id = v_prop_folder_id
      WHERE folder_id = v_root_file.id;
      
      -- Now delete the bad root folder
      DELETE FROM files WHERE id = v_root_file.id;
      
      RAISE NOTICE 'Merged root folder % into %', v_bad_root_path, v_good_path;
      v_moved_count := v_moved_count + 1;
    END LOOP;
    
    -- 2c. Catch-all: Find loose files at root that might not be in a folder structure but share the path prefix
    -- (Rare, but possible if folder_id was null)
    UPDATE files
    SET path = v_good_path || SUBSTRING(path FROM LENGTH(v_bad_root_path) + 1),
        folder_id = v_prop_folder_id
    WHERE path LIKE v_bad_root_path || '/%'
      AND path NOT LIKE v_good_path || '/%'; -- Safety check
      
  END LOOP;
  
  RAISE NOTICE 'Cleanup complete. Processed % properties.', (SELECT count(*) FROM properties);
END $$;
