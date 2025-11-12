-- Check all properties with unit map files to see their current status
SELECT 
  p.id as property_id,
  p.property_name,
  p.unit_map_file_id,
  p.unit_map_file_path,
  CASE 
    WHEN p.unit_map_file_path ~ ' ' THEN 'HAS SPACES - NEEDS FIX'
    WHEN p.unit_map_file_path IS NULL THEN 'NO UNIT MAP'
    ELSE 'CLEAN PATH'
  END as status,
  f.id as file_id,
  f.name as file_name,
  f.path as file_path,
  f.type as file_type,
  f.size as file_size,
  f.created_at
FROM properties p
LEFT JOIN files f ON p.unit_map_file_id = f.id
WHERE p.unit_map_file_path IS NOT NULL
ORDER BY 
  CASE 
    WHEN p.unit_map_file_path ~ ' ' THEN 1
    ELSE 2
  END,
  p.created_at DESC;
