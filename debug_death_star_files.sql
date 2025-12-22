-- Debug Death Star file upload paths

-- 1. Check the property name in the database
SELECT id, property_name 
FROM properties 
WHERE property_name ILIKE '%death%star%';

-- 2. Check all folders for Death Star property
SELECT 
  f.id,
  f.name,
  f.path,
  f.type,
  f.property_id,
  f.folder_id,
  f.job_id,
  p.property_name
FROM files f
LEFT JOIN properties p ON p.id = f.property_id
WHERE p.property_name ILIKE '%death%star%'
  AND f.type = 'folder/directory'
ORDER BY f.path;

-- 3. Check all uploaded files for Death Star property
SELECT 
  f.id,
  f.name,
  f.path,
  f.type,
  f.category,
  f.size,
  f.job_id,
  f.folder_id,
  p.property_name,
  j.work_order_num
FROM files f
LEFT JOIN properties p ON p.id = f.property_id
LEFT JOIN jobs j ON j.id = f.job_id
WHERE p.property_name ILIKE '%death%star%'
  AND f.type != 'folder/directory'
ORDER BY f.created_at DESC;

-- 4. Check if there are any files in storage that don't have matching database records
-- (This needs to be done via Supabase dashboard Storage browser)

-- 5. Check the most recent work order for Death Star
SELECT 
  j.id,
  j.work_order_num,
  j.property_id,
  p.property_name,
  wo.id as work_order_id
FROM jobs j
JOIN properties p ON p.id = j.property_id
LEFT JOIN work_orders wo ON wo.job_id = j.id
WHERE p.property_name ILIKE '%death%star%'
ORDER BY j.created_at DESC
LIMIT 1;
