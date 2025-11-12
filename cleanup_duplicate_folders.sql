-- Clean up duplicate and orphaned property asset folders
-- This script will identify and fix issues with the folder structure

-- First, let's see what we have
SELECT 
  'Current folder structure:' as info,
  path,
  name,
  type,
  property_id,
  id
FROM files 
WHERE path LIKE '/Property Assets%'
ORDER BY path, name;

-- Check for duplicate paths
SELECT 
  'Duplicate paths found:' as info,
  path,
  COUNT(*) as count,
  array_agg(id) as folder_ids
FROM files 
WHERE path LIKE '/Property Assets%'
GROUP BY path
HAVING COUNT(*) > 1
ORDER BY path;

-- Check for orphaned folders (folders without properties)
SELECT 
  'Orphaned folders (no property):' as info,
  f.path,
  f.name,
  f.id
FROM files f
WHERE f.path LIKE '/Property Assets%'
  AND f.type = 'folder/directory'
  AND f.property_id IS NULL
  AND f.path != '/Property Assets';

-- Check for properties without folders
SELECT 
  'Properties without folders:' as info,
  p.id,
  p.property_name
FROM properties p
WHERE NOT EXISTS (
  SELECT 1 FROM files f 
  WHERE f.property_id = p.id 
  AND f.path LIKE '/Property Assets/' || p.property_name
);

-- Clean up duplicate folders (keep the first one, delete others)
DO $$
DECLARE
  v_duplicate RECORD;
  v_keep_id uuid;
  v_delete_ids uuid[];
BEGIN
  FOR v_duplicate IN
    SELECT path, array_agg(id ORDER BY created_at) as folder_ids
    FROM files 
    WHERE path LIKE '/Property Assets%'
    GROUP BY path
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the first (oldest) folder, delete the rest
    v_keep_id := v_duplicate.folder_ids[1];
    v_delete_ids := v_duplicate.folder_ids[2:array_length(v_duplicate.folder_ids, 1)];
    
    -- Update any references to point to the kept folder
    UPDATE files 
    SET folder_id = v_keep_id 
    WHERE folder_id = ANY(v_delete_ids);
    
    -- Delete the duplicate folders
    DELETE FROM files 
    WHERE id = ANY(v_delete_ids);
    
    RAISE NOTICE 'Cleaned up duplicates for path "%": kept ID %, deleted IDs %', 
      v_duplicate.path, v_keep_id, v_delete_ids;
  END LOOP;
END $$;

-- Clean up orphaned folders (folders without properties)
DELETE FROM files 
WHERE path LIKE '/Property Assets%'
  AND type = 'folder/directory'
  AND property_id IS NULL
  AND path != '/Property Assets';

-- Verify the cleanup
SELECT 
  'Folder structure after cleanup:' as info,
  path,
  name,
  type,
  property_id,
  id
FROM files 
WHERE path LIKE '/Property Assets%'
ORDER BY path, name;

-- Final check for any remaining issues
SELECT 
  'Final status check:' as info,
  COUNT(*) as total_properties,
  COUNT(f.id) as properties_with_folders,
  COUNT(*) - COUNT(f.id) as properties_without_folders
FROM properties p
LEFT JOIN files f ON f.property_id = p.id 
  AND f.path LIKE '/Property Assets/' || p.property_name 
  AND f.type = 'folder/directory';
