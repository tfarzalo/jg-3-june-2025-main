-- Fix Work Orders folder structure
-- The issue is that work order folders exist directly under properties
-- but the get_upload_folder function expects them under a "Work Orders" folder

-- 1. Create the missing "Work Orders" folders for all properties that need them
DO $$
DECLARE
  v_property RECORD;
  v_work_orders_folder_id uuid;
  v_user_id uuid;
BEGIN
  -- Get current user or system user
  BEGIN
    v_user_id := auth.uid();
    -- If auth.uid() returns null, get the first available user
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END;
  
  -- For each property that has work order folders but no Work Orders folder
  FOR v_property IN 
    SELECT DISTINCT p.id, p.property_name
    FROM properties p
    WHERE EXISTS (
      SELECT 1 FROM files f 
      WHERE f.path LIKE '/' || p.property_name || '/WO-%' 
        AND f.type = 'folder/directory'
    )
    AND NOT EXISTS (
      SELECT 1 FROM files f 
      WHERE f.path = '/' || p.property_name || '/Work Orders' 
        AND f.type = 'folder/directory'
    )
  LOOP
    -- Create the Work Orders folder
    INSERT INTO files (
      name, 
      path, 
      type, 
      uploaded_by, 
      property_id, 
      size
    ) VALUES (
      'Work Orders',
      '/' || v_property.property_name || '/Work Orders',
      'folder/directory',
      v_user_id,
      v_property.id,
      0
    ) ON CONFLICT (path) DO NOTHING
    RETURNING id INTO v_work_orders_folder_id;
    
    -- Get the Work Orders folder ID if it already existed
    IF v_work_orders_folder_id IS NULL THEN
      SELECT id INTO v_work_orders_folder_id
      FROM files
      WHERE path = '/' || v_property.property_name || '/Work Orders' 
        AND type = 'folder/directory';
    END IF;
    
    -- Move all work order folders under the Work Orders folder
    UPDATE files 
    SET 
      path = '/' || v_property.property_name || '/Work Orders/' || name,
      folder_id = v_work_orders_folder_id
    WHERE path = '/' || v_property.property_name || '/' || name
      AND name LIKE 'WO-%'
      AND type = 'folder/directory';
    
    -- Update all subfolders and files under these work orders
    UPDATE files 
    SET path = '/' || v_property.property_name || '/Work Orders/' || 
               SUBSTRING(path FROM LENGTH('/' || v_property.property_name || '/') + 1)
    WHERE path LIKE '/' || v_property.property_name || '/WO-%/%'
      AND path NOT LIKE '/' || v_property.property_name || '/Work Orders/%';
  END LOOP;
END $$;
