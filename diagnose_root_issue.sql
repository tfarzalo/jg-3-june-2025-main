-- Check the specific property folder that is "converted to file"
SELECT id, name, type, path, folder_id, created_at 
FROM files 
WHERE type != 'folder/directory' 
   OR folder_id IS NULL 
ORDER BY created_at DESC 
LIMIT 20;

-- Check if /Properties exists and what its ID is
SELECT id, name, path, type FROM files WHERE path = '/Properties';
