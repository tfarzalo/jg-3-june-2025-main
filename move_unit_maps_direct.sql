-- Direct approach to move the 3 specific unit map files
-- This script directly updates the database records

-- Step 1: Show current state
SELECT 'BEFORE MOVE - Current unit map files:' as status;
SELECT 
  p.property_name,
  p.unit_map_file_path,
  f.name as file_name,
  f.path as file_path,
  f.folder_id
FROM properties p
LEFT JOIN files f ON f.id = p.unit_map_file_id
WHERE p.unit_map_file_path LIKE 'Property Assets/%'
ORDER BY p.property_name;

-- Step 2: Move dilworth-prop-map.png
UPDATE files 
SET 
  folder_id = (SELECT id FROM files WHERE path = '/1010 Dilworth/Property Files' AND type = 'folder/directory'),
  path = '1010 Dilworth/Property Files/dilworth-prop-map.png'
WHERE id = '40410350-357c-4db6-8856-91311fba521c';

UPDATE properties 
SET unit_map_file_path = '1010 Dilworth/Property Files/dilworth-prop-map.png'
WHERE unit_map_file_id = '40410350-357c-4db6-8856-91311fba521c';

-- Step 3: Move New Design.png
UPDATE files 
SET 
  folder_id = (SELECT id FROM files WHERE path = '/Tim''s House/Property Files' AND type = 'folder/directory'),
  path = 'Tim''s House/Property Files/New Design.png'
WHERE id = 'a181eb01-e0c6-465b-af88-dfec43bd7cb0';

UPDATE properties 
SET unit_map_file_path = 'Tim''s House/Property Files/New Design.png'
WHERE unit_map_file_id = 'a181eb01-e0c6-465b-af88-dfec43bd7cb0';

-- Step 4: Move 511-queens.jpg
UPDATE files 
SET 
  folder_id = (SELECT id FROM files WHERE path = '/511 Queens/Property Files' AND type = 'folder/directory'),
  path = '511 Queens/Property Files/511-queens.jpg'
WHERE id = '5c4d151c-c732-428b-a692-659426c6c6d8';

UPDATE properties 
SET unit_map_file_path = '511 Queens/Property Files/511-queens.jpg'
WHERE unit_map_file_id = '5c4d151c-c732-428b-a692-659426c6c6d8';

-- Step 5: Show results
SELECT 'AFTER MOVE - Updated unit map files:' as status;
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

-- Step 6: Check for remaining orphaned files
SELECT 'REMAINING ORPHANED FILES:' as status;
SELECT * FROM identify_orphaned_files();

-- Step 7: Verify Property Files folders exist
SELECT 'PROPERTY FILES FOLDERS:' as status;
SELECT name, path, type 
FROM files 
WHERE path LIKE '%/Property Files' 
  AND type = 'folder/directory'
ORDER BY path;
