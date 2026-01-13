-- Check the current status of all unit map files

-- 1. Check all properties with unit map files
SELECT 'ALL PROPERTIES WITH UNIT MAP FILES:' as status;
SELECT 
  p.property_name,
  p.unit_map_file_path,
  p.unit_map_file_id,
  f.name as file_name,
  f.path as file_path,
  f.folder_id
FROM properties p
LEFT JOIN files f ON f.id = p.unit_map_file_id
WHERE p.unit_map_file_path IS NOT NULL
ORDER BY p.property_name;

-- 2. Check specifically for the 3 files we were trying to move
SELECT 'SPECIFIC FILES WE WERE MOVING:' as status;
SELECT 
  p.property_name,
  p.unit_map_file_path,
  f.name as file_name,
  f.path as file_path,
  f.folder_id
FROM properties p
LEFT JOIN files f ON f.id = p.unit_map_file_id
WHERE p.unit_map_file_id IN (
  '40410350-357c-4db6-8856-91311fba521c',
  'a181eb01-e0c6-465b-af88-dfec43bd7cb0',
  '5c4d151c-c732-428b-a692-659426c6c6d8'
)
ORDER BY p.property_name;

-- 3. Check if these files exist in the files table
SELECT 'FILES TABLE CHECK:' as status;
SELECT 
  id,
  name,
  path,
  type,
  folder_id
FROM files 
WHERE id IN (
  '40410350-357c-4db6-8856-91311fba521c',
  'a181eb01-e0c6-465b-af88-dfec43bd7cb0',
  '5c4d151c-c732-428b-a692-659426c6c6d8'
)
ORDER BY name;

-- 4. Check for any files still in Property Assets structure
SELECT 'FILES IN PROPERTY ASSETS:' as status;
SELECT 
  id,
  name,
  path,
  type,
  folder_id
FROM files 
WHERE path LIKE 'Property Assets/%'
ORDER BY path;

-- 5. Check current orphaned files
SELECT 'CURRENT ORPHANED FILES:' as status;
SELECT * FROM identify_orphaned_files();

-- 6. Check file organization status
SELECT 'FILE ORGANIZATION STATUS:' as status;
SELECT * FROM file_organization_status;
