-- Fix Folder Path Consistency
--
-- This script finds files/folders where the 'path' does not match the parent folder's 'path'.
-- This fixes the issue where "Work Orders" folders were created with a root-level path
-- even though they were correctly linked to a parent Property folder.

DO $$
DECLARE
  v_file RECORD;
  v_new_path text;
  v_count integer := 0;
BEGIN
  -- Iterate through files that have a mismatch with their parent's path
  FOR v_file IN 
    SELECT f.id, f.name, f.path, parent.path as parent_path
    FROM files f
    JOIN files parent ON f.folder_id = parent.id
    WHERE f.path NOT LIKE parent.path || '/%'
    -- Order by path length to fix parents before children (though the recursive update handles children)
    ORDER BY LENGTH(f.path) ASC
  LOOP
    v_new_path := v_file.parent_path || '/' || v_file.name;
    
    -- Update the file's path
    UPDATE files
    SET path = v_new_path
    WHERE id = v_file.id;
    
    -- Update all children paths recursively
    -- We replace the prefix of the old path with the new path
    UPDATE files
    SET path = v_new_path || SUBSTRING(path FROM LENGTH(v_file.path) + 1)
    WHERE path LIKE v_file.path || '/%';
    
    v_count := v_count + 1;
    RAISE NOTICE 'Fixed path for % (ID: %): % -> %', v_file.name, v_file.id, v_file.path, v_new_path;
  END LOOP;
  
  RAISE NOTICE 'Fixed % file paths.', v_count;
END $$;
