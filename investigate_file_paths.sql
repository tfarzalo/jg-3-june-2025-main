-- Investigate file paths for recent uploads (511 Queens Rd property)

-- 1. Find the 511 Queens Rd property
SELECT id, property_name 
FROM properties 
WHERE property_name ILIKE '%511%queens%'
   OR property_name ILIKE '%queens%rd%';

-- 2. Find all recent jobs for 511 Queens Rd
SELECT 
  j.id as job_id,
  j.work_order_num,
  j.property_id,
  p.property_name,
  j.created_at
FROM jobs j
JOIN properties p ON p.id = j.property_id
WHERE p.property_name ILIKE '%511%queens%'
   OR p.property_name ILIKE '%queens%rd%'
ORDER BY j.created_at DESC
LIMIT 5;

-- 3. Check ALL files table entries to see what paths exist
SELECT 
  f.id,
  f.name,
  f.path,
  f.type,
  f.category,
  f.property_id,
  f.job_id,
  f.folder_id,
  p.property_name,
  f.created_at
FROM files f
LEFT JOIN properties p ON p.id = f.property_id
ORDER BY f.created_at DESC
LIMIT 50;

-- 4. Specifically check for any files with 'death_star' in the path
SELECT 
  f.id,
  f.name,
  f.path,
  f.type,
  f.category,
  f.property_id,
  f.job_id,
  f.folder_id,
  f.created_at
FROM files f
WHERE f.path ILIKE '%death%star%'
ORDER BY f.created_at DESC;

-- 5. Check for files with just property name as path (the bug!)
SELECT 
  f.id,
  f.name,
  f.path,
  f.type,
  f.category,
  f.property_id,
  f.job_id,
  f.folder_id,
  p.property_name,
  f.created_at
FROM files f
LEFT JOIN properties p ON p.id = f.property_id
WHERE f.path NOT LIKE '%/%'  -- Paths without any slashes
   OR f.path = p.property_name  -- Or just the property name
ORDER BY f.created_at DESC;

-- 6. Check the most recent uploaded file
SELECT 
  f.id,
  f.name,
  f.path,
  f.type,
  f.category,
  f.size,
  f.property_id,
  f.job_id,
  f.folder_id,
  p.property_name,
  f.created_at
FROM files f
LEFT JOIN properties p ON p.id = f.property_id
WHERE f.type != 'folder/directory'
ORDER BY f.created_at DESC
LIMIT 10;
