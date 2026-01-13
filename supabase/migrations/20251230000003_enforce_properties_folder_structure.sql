-- Enforce Properties Folder Structure
--
-- This migration updates the folder creation logic to ensure ALL property folders
-- are created inside the "/Properties" directory, rather than at the root.

-- 1. Ensure the "/Properties" folder exists
DO $$
DECLARE
  v_system_user uuid;
BEGIN
  -- Get system user
  SELECT id INTO v_system_user FROM auth.users ORDER BY created_at ASC LIMIT 1;
  
  INSERT INTO files (name, path, type, uploaded_by, size)
  VALUES ('Properties', '/Properties', 'folder/directory', v_system_user, 0)
  ON CONFLICT (path) DO NOTHING;
END $$;

-- 2. Update create_property_folder function
CREATE OR REPLACE FUNCTION create_property_folder()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_folder_id uuid;
  v_properties_folder_id uuid;
BEGIN
  -- Get system user
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_user_id FROM auth.users WHERE role = 'admin' LIMIT 1;
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    END IF;
  END;

  -- Get the main "Properties" folder ID
  SELECT id INTO v_properties_folder_id FROM files WHERE path = '/Properties' AND type = 'folder/directory';
  
  -- If missing (shouldn't happen due to block 1), create it
  IF v_properties_folder_id IS NULL THEN
    INSERT INTO files (name, path, type, uploaded_by, size)
    VALUES ('Properties', '/Properties', 'folder/directory', v_user_id, 0)
    RETURNING id INTO v_properties_folder_id;
  END IF;

  -- Create the property folder nested under Properties
  INSERT INTO files (name, path, folder_id, type, uploaded_by, property_id, size)
  VALUES (
    NEW.property_name, 
    '/Properties/' || NEW.property_name, 
    v_properties_folder_id, 
    'folder/property', 
    v_user_id, 
    NEW.id,
    0
  )
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    type = 'folder/property', -- Enforce correct type
    folder_id = v_properties_folder_id, -- Enforce correct parent
    property_id = EXCLUDED.property_id
  RETURNING id INTO v_folder_id;

  RAISE NOTICE 'Created/Updated property folder: % (ID: %)', '/Properties/' || NEW.property_name, v_folder_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 3. Update create_job_folder (create_work_order_folder) function
-- We consolidate logic here to be safe. 
CREATE OR REPLACE FUNCTION create_job_folder()
RETURNS TRIGGER AS $$
DECLARE
  v_property_folder_id uuid;
  v_properties_folder_id uuid;
  v_work_orders_folder_id uuid;
  v_job_folder_id uuid;
  v_work_order_num text;
  v_property_name text;
  v_user_id uuid;
BEGIN
  -- Get user
  v_user_id := COALESCE(auth.uid(), NEW.created_by);

  -- Get Property Name
  SELECT property_name INTO v_property_name FROM properties WHERE id = NEW.property_id;

  -- 1. Ensure /Properties exists
  SELECT id INTO v_properties_folder_id FROM files WHERE path = '/Properties';
  IF v_properties_folder_id IS NULL THEN
    INSERT INTO files (name, path, type, uploaded_by, size)
    VALUES ('Properties', '/Properties', 'folder/directory', v_user_id, 0)
    RETURNING id INTO v_properties_folder_id;
  END IF;

  -- 2. Ensure /Properties/{Name} exists
  SELECT id INTO v_property_folder_id FROM files WHERE path = '/Properties/' || v_property_name;
  IF v_property_folder_id IS NULL THEN
    INSERT INTO files (name, path, folder_id, type, uploaded_by, property_id, size)
    VALUES (v_property_name, '/Properties/' || v_property_name, v_properties_folder_id, 'folder/property', v_user_id, NEW.property_id, 0)
    RETURNING id INTO v_property_folder_id;
  END IF;

  -- 3. Ensure /Properties/{Name}/Work Orders exists
  SELECT id INTO v_work_orders_folder_id FROM files WHERE path = '/Properties/' || v_property_name || '/Work Orders';
  IF v_work_orders_folder_id IS NULL THEN
    INSERT INTO files (name, path, folder_id, type, uploaded_by, property_id, size)
    VALUES ('Work Orders', '/Properties/' || v_property_name || '/Work Orders', v_property_folder_id, 'folder/directory', v_user_id, NEW.property_id, 0)
    RETURNING id INTO v_work_orders_folder_id;
  END IF;

  -- 4. Create Job Folder
  v_work_order_num := 'WO-' || LPAD(NEW.work_order_num::text, 6, '0');
  
  INSERT INTO files (
    name,
    path,
    size,
    type,
    uploaded_by,
    property_id,
    job_id,
    folder_id
  ) VALUES (
    v_work_order_num,
    '/Properties/' || v_property_name || '/Work Orders/' || v_work_order_num,
    0,
    'folder/job',
    v_user_id,
    NEW.property_id,
    NEW.id,
    v_work_orders_folder_id
  )
  ON CONFLICT (path) DO NOTHING
  RETURNING id INTO v_job_folder_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-attach trigger if needed (usually handled by existing migration, but good to be safe)
DROP TRIGGER IF EXISTS create_job_folder_trigger ON jobs;
CREATE TRIGGER create_job_folder_trigger
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION create_job_folder();
