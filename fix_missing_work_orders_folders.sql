-- Fix Missing Work Orders Folders
-- This script diagnoses and fixes missing Work Orders folders

-- Step 1: Check which properties are missing Work Orders folders
SELECT 'PROPERTIES MISSING WORK ORDERS FOLDERS:' as status;
SELECT 
  p.id as property_id,
  p.property_name,
  CASE 
    WHEN wo_folder.id IS NULL THEN 'MISSING Work Orders folder'
    ELSE 'Work Orders folder EXISTS'
  END as work_orders_status
FROM properties p
LEFT JOIN files wo_folder ON (
  wo_folder.path = '/' || p.property_name || '/Work Orders' 
  AND wo_folder.type = 'folder/directory'
)
ORDER BY p.property_name;

-- Step 2: Check the complete folder structure for 1010 Dilworth specifically
SELECT '1010 DILWORTH FOLDER STRUCTURE:' as status;
SELECT 
  name,
  path,
  type,
  folder_id
FROM files 
WHERE path LIKE '%1010 Dilworth%'
ORDER BY path;

-- Step 3: Create missing Work Orders folders for all properties
DO $$
DECLARE
  v_property RECORD;
  v_property_folder_id uuid;
  v_work_orders_folder_id uuid;
  v_user_id uuid;
  v_created_count INTEGER := 0;
BEGIN
  -- Get current user or system user
  BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END;
  
  -- Find properties missing Work Orders folders
  FOR v_property IN 
    SELECT 
      p.id as property_id,
      p.property_name
    FROM properties p
    LEFT JOIN files wo_folder ON (
      wo_folder.path = '/' || p.property_name || '/Work Orders' 
      AND wo_folder.type = 'folder/directory'
    )
    WHERE wo_folder.id IS NULL
  LOOP
    BEGIN
      -- Get or create property folder
      SELECT id INTO v_property_folder_id
      FROM files
      WHERE path = '/' || v_property.property_name 
        AND type = 'folder/directory';
      
      -- If property folder doesn't exist, create it
      IF v_property_folder_id IS NULL THEN
        INSERT INTO files (
          name, path, type, uploaded_by, property_id, folder_id, size
        ) VALUES (
          v_property.property_name,
          '/' || v_property.property_name,
          'folder/directory',
          v_user_id,
          v_property.property_id,
          NULL,
          0
        )
        RETURNING id INTO v_property_folder_id;
      END IF;
      
      -- Create Work Orders folder
      INSERT INTO files (
        name, path, type, uploaded_by, property_id, folder_id, size
      ) VALUES (
        'Work Orders',
        '/' || v_property.property_name || '/Work Orders',
        'folder/directory',
        v_user_id,
        v_property.property_id,
        v_property_folder_id,
        0
      )
      ON CONFLICT (path) DO NOTHING
      RETURNING id INTO v_work_orders_folder_id;
      
      IF v_work_orders_folder_id IS NOT NULL THEN
        v_created_count := v_created_count + 1;
        RAISE NOTICE 'Created Work Orders folder for property: %', v_property.property_name;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error creating Work Orders folder for %: %', v_property.property_name, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Created % Work Orders folders', v_created_count;
END $$;

-- Step 4: Verify the fix - check Work Orders folders again
SELECT 'AFTER FIX - WORK ORDERS FOLDERS:' as status;
SELECT 
  p.property_name,
  wo_folder.path as work_orders_path,
  CASE 
    WHEN wo_folder.id IS NULL THEN 'STILL MISSING'
    ELSE 'NOW EXISTS'
  END as status
FROM properties p
LEFT JOIN files wo_folder ON (
  wo_folder.path = '/' || p.property_name || '/Work Orders' 
  AND wo_folder.type = 'folder/directory'
)
ORDER BY p.property_name;

-- Step 5: Check 1010 Dilworth specifically
SELECT '1010 DILWORTH AFTER FIX:' as status;
SELECT 
  name,
  path,
  type
FROM files 
WHERE path LIKE '%1010 Dilworth%'
ORDER BY path;

-- Step 6: Test the get_upload_folder function for 1010 Dilworth
SELECT 'TEST get_upload_folder FOR 1010 DILWORTH:' as status;
SELECT get_upload_folder(
  (SELECT id FROM properties WHERE property_name = '1010 Dilworth'),
  NULL,
  'other'
) as folder_id;
