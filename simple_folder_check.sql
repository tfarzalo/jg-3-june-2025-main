-- Simple check to verify the folder fix

-- 1. Check what folder the returned ID corresponds to
SELECT 
  id,
  name,
  path,
  type
FROM files 
WHERE id = '30631cf7-4924-445f-9486-bb7598c24cfc';

-- 2. Check 1010 Dilworth folder structure
SELECT 
  name,
  path,
  type
FROM files 
WHERE path LIKE '%1010 Dilworth%'
ORDER BY path;
