-- Check what folder structure actually exists
SELECT 
  id,
  name,
  path,
  type,
  property_id,
  folder_id
FROM files
WHERE type = 'folder/directory'
  AND (
    path LIKE '%511%'
    OR path LIKE '%Death%Star%'
    OR path LIKE '%Dilworth%'
  )
ORDER BY path;

-- Now let's manually fix the specific problematic file
-- File: 511 Queens/Work Orders/WO-000477/Before Images/1762849047069-hio4qk-jg-image-test.jpg
-- Should be in folder: /511 Queens/Work Orders/WO-000477/Before Images (id: 267c9f85-9663-4e3c-9b09-fbb2c6a4f751)

UPDATE files
SET folder_id = '267c9f85-9663-4e3c-9b09-fbb2c6a4f751'
WHERE id = '9d550c34-7803-4239-9ac4-3fc0d318d784';

-- Check if it worked
SELECT 
  f.id,
  f.name,
  f.path,
  f.folder_id,
  folder.path as folder_path
FROM files f
LEFT JOIN files folder ON folder.id = f.folder_id
WHERE f.id = '9d550c34-7803-4239-9ac4-3fc0d318d784';
