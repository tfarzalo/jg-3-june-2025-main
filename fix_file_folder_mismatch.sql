-- Fix: Correct folder IDs for existing uploaded files
-- The issue: Files were uploaded to storage correctly but saved with wrong folder_id in database

-- First, let's see the mismatched files
SELECT 
  f.id,
  f.name,
  f.path as file_path,
  f.folder_id as current_folder_id,
  f.category,
  current_folder.path as current_folder_path,
  correct_folder.id as correct_folder_id,
  correct_folder.path as correct_folder_path
FROM files f
LEFT JOIN files current_folder ON current_folder.id = f.folder_id
LEFT JOIN LATERAL (
  -- Find the correct folder by matching the path prefix
  SELECT id, path
  FROM files
  WHERE type = 'folder/directory'
    AND f.path LIKE path || '/%'
    AND f.path != path
  ORDER BY length(path) DESC
  LIMIT 1
) correct_folder ON true
WHERE f.type != 'folder/directory'
  AND f.folder_id IS NOT NULL
  AND f.path NOT LIKE current_folder.path || '/%'
ORDER BY f.created_at DESC
LIMIT 20;

-- Now fix them by updating folder_id to match the actual path
UPDATE files f
SET folder_id = (
  SELECT id
  FROM files parent
  WHERE parent.type = 'folder/directory'
    AND f.path LIKE parent.path || '/%'
    AND f.path != parent.path
  ORDER BY length(parent.path) DESC
  LIMIT 1
)
WHERE f.type != 'folder/directory'
  AND f.folder_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM files current_folder
    WHERE current_folder.id = f.folder_id
      AND f.path NOT LIKE current_folder.path || '/%'
  );

-- Verify the fix
SELECT 
  f.id,
  f.name,
  f.path as file_path,
  f.folder_id,
  f.category,
  folder.path as folder_path,
  CASE 
    WHEN f.path LIKE folder.path || '/%' THEN '✅ MATCHED'
    ELSE '❌ MISMATCH'
  END as status
FROM files f
LEFT JOIN files folder ON folder.id = f.folder_id
WHERE f.type != 'folder/directory'
ORDER BY f.created_at DESC
LIMIT 20;
