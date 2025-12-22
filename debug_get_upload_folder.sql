-- Debug the get_upload_folder function

-- 1. Check the function signature and parameters
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines 
WHERE routine_name = 'get_upload_folder';

-- 2. Test the function with the specific property ID from the error
-- The property ID from the logs is: 86585c6c-93b4-44c9-a7a5-5be077e8e2a8
SELECT 'TESTING get_upload_folder with property ID from error:' as status;
SELECT get_upload_folder(
  '86585c6c-93b4-44c9-a7a5-5be077e8e2a8'::uuid,
  NULL,
  'before'
) as folder_id;

-- 3. Check if this property exists and has the right structure
SELECT 'PROPERTY DETAILS:' as status;
SELECT 
  id,
  property_name,
  unit_map_file_path
FROM properties 
WHERE id = '86585c6c-93b4-44c9-a7a5-5be077e8e2a8';

-- 4. Check folder structure for this property
SELECT 'FOLDER STRUCTURE FOR THIS PROPERTY:' as status;
SELECT 
  name,
  path,
  type,
  folder_id
FROM files 
WHERE path LIKE '%' || (SELECT property_name FROM properties WHERE id = '86585c6c-93b4-44c9-a7a5-5be077e8e2a8') || '%'
ORDER BY path;

-- 5. Test with a job_id if available
SELECT 'TESTING WITH JOB_ID:' as status;
SELECT get_upload_folder(
  '86585c6c-93b4-44c9-a7a5-5be077e8e2a8'::uuid,
  (SELECT id FROM jobs WHERE property_id = '86585c6c-93b4-44c9-a7a5-5be077e8e2a8' LIMIT 1),
  'before'
) as folder_id;

-- 6. Check what jobs exist for this property
SELECT 'JOBS FOR THIS PROPERTY:' as status;
SELECT 
  j.id as job_id,
  j.work_order_num,
  p.property_name
FROM jobs j
JOIN properties p ON p.id = j.property_id
WHERE j.property_id = '86585c6c-93b4-44c9-a7a5-5be077e8e2a8'
ORDER BY j.work_order_num;
