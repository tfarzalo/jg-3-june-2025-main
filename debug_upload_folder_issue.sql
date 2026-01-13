-- Debug the get_upload_folder function issue
-- Let's check what's happening step by step

-- 1. Check if the property exists
SELECT 
  id,
  property_name,
  'Property exists' as status
FROM properties 
WHERE id = '86585c6c-93b4-44c9-a7a5-5be077e8e2a8';

-- 2. Check if the job exists
SELECT 
  id,
  work_order_num,
  property_id,
  'Job exists' as status
FROM jobs 
WHERE id = 'd3818d76-ba6b-4903-aa42-db46c911e5d7';

-- 3. Check if the Work Orders folder exists for this property
SELECT 
  id,
  name,
  path,
  type,
  'Work Orders folder' as status
FROM files 
WHERE path = '/1010 Dilworth/Work Orders' 
  AND type = 'folder/directory';

-- 4. Check if the specific work order folder exists
SELECT 
  id,
  name,
  path,
  type,
  'Work Order folder' as status
FROM files 
WHERE path LIKE '/1010 Dilworth/Work Orders/WO-%' 
  AND type = 'folder/directory'
  AND path LIKE '%WO-000389%';

-- 5. Check if the Before Images folder exists
SELECT 
  id,
  name,
  path,
  type,
  'Before Images folder' as status
FROM files 
WHERE path = '/1010 Dilworth/Work Orders/WO-000389/Before Images' 
  AND type = 'folder/directory';

-- 6. Test the function directly
SELECT 
  'Testing get_upload_folder function' as test,
  get_upload_folder(
    '86585c6c-93b4-44c9-a7a5-5be077e8e2a8'::uuid, 
    'd3818d76-ba6b-4903-aa42-db46c911e5d7'::uuid, 
    'before'
  ) as result;
