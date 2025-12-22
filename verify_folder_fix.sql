-- Verify the folder fix is working properly

-- 1. Check what folder the returned ID corresponds to
SELECT 'FOLDER DETAILS FOR RETURNED ID:' as status;
SELECT 
  id,
  name,
  path,
  type,
  folder_id
FROM files 
WHERE id = '30631cf7-4924-445f-9486-bb7598c24cfc';

-- 2. Check the complete folder structure for 1010 Dilworth
SELECT '1010 DILWORTH COMPLETE FOLDER STRUCTURE:' as status;
SELECT 
  name,
  path,
  type,
  folder_id
FROM files 
WHERE path LIKE '%1010 Dilworth%'
ORDER BY path;

-- 3. Test get_upload_folder for different scenarios with 1010 Dilworth
SELECT 'TEST get_upload_folder SCENARIOS:' as status;

-- Test for Property Files folder (no job_id)
SELECT 
  'Property Files folder' as test_type,
  get_upload_folder(
    (SELECT id FROM properties WHERE property_name = '1010 Dilworth'),
    NULL,
    'other'
  ) as folder_id;

-- Test for Work Orders folder (with job_id)
SELECT 
  'Work Orders folder' as test_type,
  get_upload_folder(
    (SELECT id FROM properties WHERE property_name = '1010 Dilworth'),
    (SELECT id FROM jobs WHERE property_id = (SELECT id FROM properties WHERE property_name = '1010 Dilworth') LIMIT 1),
    'before'
  ) as folder_id;

-- 4. Check if there are any jobs for 1010 Dilworth
SELECT 'JOBS FOR 1010 DILWORTH:' as status;
SELECT 
  j.id as job_id,
  j.work_order_num,
  p.property_name
FROM jobs j
JOIN properties p ON p.id = j.property_id
WHERE p.property_name = '1010 Dilworth'
ORDER BY j.work_order_num;

-- 5. Check current file organization status
SELECT 'CURRENT FILE ORGANIZATION STATUS:' as status;
SELECT * FROM file_organization_status;
