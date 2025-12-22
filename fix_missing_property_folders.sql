-- Fix missing property asset folders
-- This script will create missing property asset folders for properties that don't have them

-- First, let's check which properties are missing folders
SELECT 
  'Properties missing asset folders:' as info,
  p.id,
  p.property_name,
  CASE 
    WHEN f.id IS NULL THEN 'MISSING'
    ELSE 'EXISTS'
  END as folder_status
FROM properties p
LEFT JOIN files f ON f.property_id = p.id 
  AND f.path LIKE '/Property Assets/' || p.property_name 
  AND f.type = 'folder/directory'
ORDER BY p.property_name;

-- Now let's create the missing folders
DO $$
DECLARE
  v_property RECORD;
  v_property_assets_folder_id uuid;
  v_user_id uuid;
  v_folder_id uuid;
BEGIN
  -- Get the Property Assets root folder ID
  SELECT id INTO v_property_assets_folder_id
  FROM files 
  WHERE path = '/Property Assets' 
  AND type = 'folder/directory'
  LIMIT 1;
  
  -- If root folder doesn't exist, create it
  IF v_property_assets_folder_id IS NULL THEN
    -- Get the first user from auth.users
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    
    INSERT INTO files (name, path, type, uploaded_by, folder_id, size, property_id, job_id)
    VALUES (
      'Property Assets',
      '/Property Assets',
      'folder/directory',
      v_user_id,
      NULL,
      0,
      NULL,
      NULL
    )
    RETURNING id INTO v_property_assets_folder_id;
    
    RAISE NOTICE 'Created Property Assets root folder with ID: %', v_property_assets_folder_id;
  END IF;
  
  -- Get a system user ID
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  
  -- Create missing folders for all properties
  FOR v_property IN 
    SELECT p.id, p.property_name
    FROM properties p
    LEFT JOIN files f ON f.property_id = p.id 
      AND f.path LIKE '/Property Assets/' || p.property_name 
      AND f.type = 'folder/directory'
    WHERE f.id IS NULL
  LOOP
    -- Check if folder already exists by path (more reliable than name)
    IF NOT EXISTS (
      SELECT 1 FROM files 
      WHERE path = '/Property Assets/' || v_property.property_name
    ) THEN
      -- Create the property-specific folder
      INSERT INTO files (name, path, type, uploaded_by, property_id, folder_id, size, job_id)
      VALUES (
        v_property.property_name || ' Assets',
        '/Property Assets/' || v_property.property_name,
        'folder/directory',
        v_user_id,
        v_property.id,
        v_property_assets_folder_id,
        0,
        NULL
      )
      RETURNING id INTO v_folder_id;
      
      RAISE NOTICE 'Created asset folder for property "%" with ID: %', v_property.property_name, v_folder_id;
    ELSE
      RAISE NOTICE 'Folder already exists for property "%"', v_property.property_name;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Finished creating missing property asset folders';
END $$;

-- Verify the folders were created
SELECT 
  'Property asset folders after fix:' as info,
  p.property_name,
  f.path,
  f.type,
  f.id as folder_id
FROM properties p
JOIN files f ON f.property_id = p.id 
  AND f.path LIKE '/Property Assets/' || p.property_name 
  AND f.type = 'folder/directory'
ORDER BY p.property_name;
