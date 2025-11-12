-- Check what files actually exist in storage for a specific property
-- Replace '1010 Dilworth' with the actual property name

-- First, let's see what's in the database
SELECT 
  p.id as property_id,
  p.property_name,
  p.unit_map_file_id,
  p.unit_map_file_path,
  f.id as file_id,
  f.name as file_name,
  f.path as file_path,
  f.type as file_type,
  f.size as file_size,
  f.created_at
FROM properties p
LEFT JOIN files f ON p.unit_map_file_id = f.id
WHERE p.property_name ILIKE '%1010%' OR p.property_name ILIKE '%Dilworth%'
ORDER BY p.created_at DESC;

-- Check all files for properties with similar names
SELECT 
  f.id,
  f.name,
  f.path,
  f.type,
  f.size,
  f.created_at,
  p.property_name
FROM files f
LEFT JOIN properties p ON f.property_id = p.id
WHERE f.name LIKE '%unit-map%' 
  AND (p.property_name ILIKE '%1010%' OR p.property_name ILIKE '%Dilworth%')
ORDER BY f.created_at DESC;
