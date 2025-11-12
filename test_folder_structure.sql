-- Test the current folder structure and function
-- This can be run in the Supabase SQL editor

-- 1. Check current folder structure for 1010 Dilworth
SELECT 
  'Current 1010 Dilworth folders:' as info,
  name,
  path,
  type,
  folder_id
FROM files 
WHERE path LIKE '/1010 Dilworth%' 
  AND type = 'folder/directory'
ORDER BY path;

-- 2. Check if the specific Before Images folder exists
SELECT 
  'Before Images folder check:' as info,
  id,
  name,
  path,
  type
FROM files 
WHERE path = '/1010 Dilworth/Work Orders/WO-000389/Before Images' 
  AND type = 'folder/directory';

-- 3. Check if the Work Orders folder exists
SELECT 
  'Work Orders folder check:' as info,
  id,
  name,
  path,
  type
FROM files 
WHERE path = '/1010 Dilworth/Work Orders' 
  AND type = 'folder/directory';

-- 4. Test the function with the exact parameters from the frontend
SELECT 
  'Function test result:' as info,
  get_upload_folder(
    '86585c6c-93b4-44c9-a7a5-5be077e8e2a8'::uuid, 
    'd3818d76-ba6b-4903-aa42-db46c911e5d7'::uuid, 
    'before'
  ) as folder_id;

-- 5. If the function fails, let's see what the error is
DO $$
DECLARE
  v_result uuid;
BEGIN
  BEGIN
    v_result := get_upload_folder(
      '86585c6c-93b4-44c9-a7a5-5be077e8e2a8'::uuid, 
      'd3818d76-ba6b-4903-aa42-db46c911e5d7'::uuid, 
      'before'
    );
    RAISE NOTICE 'Function succeeded, result: %', v_result;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Function failed with error: %', SQLERRM;
  END;
END $$;
