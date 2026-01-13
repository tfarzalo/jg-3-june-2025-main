-- Direct fix: Update folder_id for all files based on their path
-- This will match files to their correct parent folder

-- Fix work order image files (with spaces in path)
UPDATE files f
SET folder_id = parent.id
FROM files parent
WHERE f.type != 'folder/directory'
  AND f.folder_id IS NULL
  AND parent.type = 'folder/directory'
  AND (
    -- Match files in Work Orders subfolders
    f.path LIKE parent.path || '/%'
    OR 
    -- Match files in Property Files
    f.path LIKE '%Property_Files/%' AND parent.path LIKE '%Property_Files'
  )
  AND parent.id = (
    -- Get the most specific (longest path) parent folder
    SELECT id
    FROM files p
    WHERE p.type = 'folder/directory'
      AND f.path LIKE p.path || '/%'
    ORDER BY length(p.path) DESC
    LIMIT 1
  );

-- Alternative simpler approach - match by exact path prefix
UPDATE files f
SET folder_id = (
  SELECT id
  FROM files parent
  WHERE parent.type = 'folder/directory'
    AND f.path LIKE parent.path || '/%'
  ORDER BY length(parent.path) DESC
  LIMIT 1
)
WHERE f.type != 'folder/directory'
  AND f.folder_id IS NULL;

-- Verify the fix
SELECT 
  f.id,
  f.name,
  f.path,
  f.folder_id,
  f.category,
  folder.path as folder_path,
  CASE 
    WHEN f.folder_id IS NOT NULL THEN '✅ HAS FOLDER'
    ELSE '❌ NO FOLDER'
  END as status
FROM files f
LEFT JOIN files folder ON folder.id = f.folder_id
WHERE f.type != 'folder/directory'
  AND f.category IN ('before', 'sprinkler', 'other')
ORDER BY f.created_at DESC
LIMIT 20;
