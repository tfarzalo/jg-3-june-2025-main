-- Fix Work Orders folder structure
-- The issue is that work order folders exist directly under properties
-- but the get_upload_folder function expects them under a "Work Orders" folder

-- 1. First, let's see what the current structure looks like
SELECT 
  'Current folder structure:' as info,
  name,
  path,
  type
FROM files 
WHERE path LIKE '/1010 Dilworth%' 
  AND type = 'folder/directory'
ORDER BY path;

-- 2. Create the missing "Work Orders" folder for 1010 Dilworth
INSERT INTO files (
  name, 
  path, 
  type, 
  uploaded_by, 
  property_id, 
  size
) VALUES (
  'Work Orders',
  '/1010 Dilworth/Work Orders',
  'folder/directory',
  (SELECT id FROM auth.users LIMIT 1),
  '86585c6c-93b4-44c9-a7a5-5be077e8e2a8',
  0
) ON CONFLICT (path) DO NOTHING;

-- 3. Get the Work Orders folder ID
DO $$
DECLARE
  v_work_orders_folder_id uuid;
  v_wo_folder RECORD;
BEGIN
  -- Get the Work Orders folder ID
  SELECT id INTO v_work_orders_folder_id
  FROM files
  WHERE path = '/1010 Dilworth/Work Orders' AND type = 'folder/directory';
  
  -- Update all work order folders to be under the Work Orders folder
  FOR v_wo_folder IN 
    SELECT id, name, path
    FROM files
    WHERE path LIKE '/1010 Dilworth/WO-%' 
      AND type = 'folder/directory'
      AND path NOT LIKE '/1010 Dilworth/Work Orders/%'
  LOOP
    -- Update the folder to be under Work Orders
    UPDATE files 
    SET 
      path = '/1010 Dilworth/Work Orders/' || v_wo_folder.name,
      folder_id = v_work_orders_folder_id
    WHERE id = v_wo_folder.id;
    
    -- Update all subfolders and files under this work order
    UPDATE files 
    SET path = '/1010 Dilworth/Work Orders/' || v_wo_folder.name || '/' || 
               SUBSTRING(path FROM LENGTH('/1010 Dilworth/' || v_wo_folder.name) + 1)
    WHERE path LIKE '/1010 Dilworth/' || v_wo_folder.name || '/%'
      AND id != v_wo_folder.id;
  END LOOP;
END $$;

-- 4. Verify the new structure
SELECT 
  'Updated folder structure:' as info,
  name,
  path,
  type
FROM files 
WHERE path LIKE '/1010 Dilworth%' 
  AND type = 'folder/directory'
ORDER BY path;

-- 5. Test the get_upload_folder function
SELECT 
  'Testing get_upload_folder function:' as test,
  get_upload_folder(
    '86585c6c-93b4-44c9-a7a5-5be077e8e2a8'::uuid, 
    'd3818d76-ba6b-4903-aa42-db46c911e5d7'::uuid, 
    'before'
  ) as result;
