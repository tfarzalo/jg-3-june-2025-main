-- Debug query to check unit map files in the database
-- Run this in the Supabase SQL editor to see what's actually stored

-- Check properties with unit map files
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
WHERE p.unit_map_file_path IS NOT NULL
ORDER BY p.created_at DESC;

-- Check all files for a specific property (replace with actual property ID)
-- SELECT * FROM files WHERE property_id = 'your-property-id-here' ORDER BY created_at DESC;

-- Check if there are any files with similar names
-- SELECT * FROM files WHERE name LIKE '%unit-map%' ORDER BY created_at DESC;
