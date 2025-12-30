/*
  Force Fix Property Paths
  
  This script aggressively fixes file paths for properties.
  It finds ANY file or folder that is located at the root "/{PropertyName}" 
  and moves it to "/Properties/{PropertyName}".
  
  It handles:
  1. Files/Folders with correct folder_id but wrong path.
  2. Files/Folders with wrong folder_id and wrong path.
  3. "Phantom" root folders (by moving their children).
  4. Real root folders (by merging/moving them).
*/

DO $$
DECLARE
  v_prop RECORD;
  v_bad_path_prefix text;
  v_good_path_prefix text;
  v_correct_parent_id uuid;
  v_root_folder_id uuid;
  v_file RECORD;
  v_moved_count INTEGER := 0;
BEGIN
  -- Loop through every property in the system
  FOR v_prop IN SELECT id, property_name FROM properties LOOP
    
    v_bad_path_prefix := '/' || v_prop.property_name;
    v_good_path_prefix := '/Properties/' || v_prop.property_name;
    
    -- 1. Get the ID of the correct destination folder (Properties/{Name})
    SELECT id INTO v_correct_parent_id 
    FROM files 
    WHERE path = v_good_path_prefix AND type = 'folder/property';
    
    -- If the correct parent folder exists, we can proceed to move things into it
    IF v_correct_parent_id IS NOT NULL THEN
    
      -- 2. Find any files/folders that are sitting at the bad path prefix
      -- This matches "/Name/Work Orders", "/Name/File.txt", etc.
      FOR v_file IN 
        SELECT id, name, path, type 
        FROM files 
        WHERE path LIKE v_bad_path_prefix || '/%'
          AND path NOT LIKE v_good_path_prefix || '/%' -- Exclude if somehow path is similar but correct
      LOOP
        -- Check if a file with the same name already exists in the destination
        -- e.g. moving "/Name/Work Orders" to "/Properties/Name/Work Orders"
        IF EXISTS (SELECT 1 FROM files WHERE path = v_good_path_prefix || '/' || v_file.name AND id != v_file.id) THEN
          -- COLLISION: The destination already exists.
          
          IF v_file.type = 'folder/directory' OR v_file.type = 'folder/job' THEN
             -- If it's a folder, we update its children to point to the existing destination folder
             -- Then we delete this duplicate folder
             DECLARE
               v_dest_folder_id uuid;
             BEGIN
               SELECT id INTO v_dest_folder_id FROM files WHERE path = v_good_path_prefix || '/' || v_file.name;
               
               -- Move children of v_file to v_dest_folder_id
               UPDATE files
               SET folder_id = v_dest_folder_id,
                   path = v_good_path_prefix || '/' || v_file.name || '/' || name
               WHERE folder_id = v_file.id;
               
               -- Recursive path update for grandchildren
               UPDATE files
               SET path = v_good_path_prefix || '/' || v_file.name || SUBSTRING(path FROM LENGTH(v_file.path) + 1)
               WHERE path LIKE v_file.path || '/%';
               
               -- Delete the duplicate folder
               DELETE FROM files WHERE id = v_file.id;
               RAISE NOTICE 'Merged duplicate folder % into %', v_file.path, v_good_path_prefix || '/' || v_file.name;
             END;
          ELSE
             -- If it's a file, we can't easily merge. We'll rename it to avoid conflict or skip.
             -- For now, let's update path but keep ID, letting unique constraint fail if strictly enforced?
             -- Supabase storage usually enforces unique path.
             -- Let's append a timestamp to the name to be safe.
             UPDATE files
             SET path = v_good_path_prefix || '/' || v_file.name || '_' || extract(epoch from now())::text,
                 folder_id = v_correct_parent_id
             WHERE id = v_file.id;
             RAISE NOTICE 'Moved file with rename %', v_file.path;
          END IF;
          
        ELSE
          -- NO COLLISION: Just move it
          UPDATE files
          SET path = v_good_path_prefix || '/' || v_file.name,
              folder_id = v_correct_parent_id
          WHERE id = v_file.id;
          
          -- Update all children recursively
          UPDATE files
          SET path = v_good_path_prefix || '/' || v_file.name || SUBSTRING(path FROM LENGTH(v_file.path) + 1)
          WHERE path LIKE v_file.path || '/%';
          
          RAISE NOTICE 'Moved % to %', v_file.path, v_good_path_prefix || '/' || v_file.name;
          v_moved_count := v_moved_count + 1;
        END IF;
        
      END LOOP;
      
      -- 3. Check if the Root Property Folder itself exists as a row and delete/move it
      SELECT id INTO v_root_folder_id FROM files WHERE path = v_bad_path_prefix;
      IF v_root_folder_id IS NOT NULL THEN
        -- If it exists, and we've already moved its children, we can delete it (since destination exists)
        DELETE FROM files WHERE id = v_root_folder_id;
        RAISE NOTICE 'Deleted root property folder row: %', v_bad_path_prefix;
      END IF;

    END IF; -- End if correct parent exists
    
  END LOOP;
  
  RAISE NOTICE 'Fixed paths for % items.', v_moved_count;
END $$;
