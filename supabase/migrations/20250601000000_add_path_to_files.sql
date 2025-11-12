-- Add 'path' column back to files table if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'files' AND column_name = 'path') THEN
    ALTER TABLE files ADD COLUMN path text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Add unique constraint on path if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'files_path_key') THEN
    ALTER TABLE files ADD CONSTRAINT files_path_key UNIQUE (path);
  END IF;
END $$;

-- Add triggers to create folders for properties and work orders

-- Trigger to create a folder for a new property
CREATE OR REPLACE FUNCTION create_property_folder()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_folder_id uuid;
BEGIN
  -- Try to get the current user ID, fall back to system user if not available
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    -- Get the first admin user as system user
    SELECT id INTO v_user_id FROM auth.users WHERE role = 'admin' LIMIT 1;
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'No system user found for folder creation';
    END IF;
  END;

  -- Create the property folder
  INSERT INTO files (name, path, folder_id, type, uploaded_by, property_id)
  VALUES (NEW.property_name, '/' || NEW.property_name, NULL, 'folder/directory', v_user_id, NEW.id)
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    uploaded_by = EXCLUDED.uploaded_by,
    property_id = EXCLUDED.property_id
  RETURNING id INTO v_folder_id;

  -- Log the folder creation
  RAISE NOTICE 'Created property folder: % (ID: %)', NEW.property_name, v_folder_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_property_folder
AFTER INSERT ON properties
FOR EACH ROW
EXECUTE FUNCTION create_property_folder();

-- Create a function to create folders for all existing properties
CREATE OR REPLACE FUNCTION create_folders_for_all_properties()
RETURNS void AS $$
DECLARE
  v_property RECORD;
  v_user_id uuid;
BEGIN
  -- Get the first admin user as system user
  SELECT id INTO v_user_id 
  FROM auth.users 
  WHERE role = 'admin' 
  ORDER BY created_at ASC 
  LIMIT 1;
  
  IF v_user_id IS NULL THEN
    -- If no admin user found, try to get any user
    SELECT id INTO v_user_id 
    FROM auth.users 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF v_user_id IS NULL THEN
      RAISE EXCEPTION 'No system user found for folder creation';
    END IF;
  END IF;

  FOR v_property IN SELECT * FROM properties LOOP
    -- Check if folder already exists
    IF NOT EXISTS (
      SELECT 1 FROM files 
      WHERE property_id = v_property.id 
      AND type = 'folder/directory' 
      AND folder_id IS NULL
    ) THEN
      -- Create the property folder
      INSERT INTO files (name, path, folder_id, type, uploaded_by, property_id)
      VALUES (
        v_property.property_name,
        '/' || v_property.property_name,
        NULL,
        'folder/directory',
        v_user_id,
        v_property.id
      )
      ON CONFLICT (path) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        uploaded_by = EXCLUDED.uploaded_by,
        property_id = EXCLUDED.property_id;

      RAISE NOTICE 'Created folder for property: %', v_property.property_name;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to create folders for all properties
SELECT create_folders_for_all_properties();

-- Update the create_work_order_folder function to create property folder if it doesn't exist
CREATE OR REPLACE FUNCTION create_work_order_folder()
RETURNS TRIGGER AS $$
DECLARE
  property_folder_id uuid;
  work_order_folder_path text;
  v_user_id uuid;
  v_property_name text;
BEGIN
  -- Try to get the current user ID, fall back to system user if not available
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    -- Get the first admin user as system user
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE role = 'admin' 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF v_user_id IS NULL THEN
      -- If no admin user found, try to get any user
      SELECT id INTO v_user_id 
      FROM auth.users 
      ORDER BY created_at ASC 
      LIMIT 1;
      
      IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No system user found for folder creation';
      END IF;
    END IF;
  END;

  -- Get property name
  SELECT property_name INTO v_property_name FROM properties WHERE id = NEW.property_id;
  IF v_property_name IS NULL THEN
    RAISE EXCEPTION 'Property not found for property_id: %', NEW.property_id;
  END IF;

  -- Get or create the property folder ID
  SELECT id INTO property_folder_id 
  FROM files 
  WHERE property_id = NEW.property_id 
    AND type = 'folder/directory' 
    AND folder_id IS NULL;

  IF property_folder_id IS NULL THEN
    -- Create the property folder if it doesn't exist
    INSERT INTO files (name, path, folder_id, type, uploaded_by, property_id)
    VALUES (v_property_name, '/' || v_property_name, NULL, 'folder/directory', v_user_id, NEW.property_id)
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      property_id = EXCLUDED.property_id
    RETURNING id INTO property_folder_id;

    RAISE NOTICE 'Created missing property folder: % (ID: %)', v_property_name, property_folder_id;
  END IF;

  -- Construct the work order folder path
  work_order_folder_path := '/' || v_property_name || '/WO-' || LPAD(NEW.work_order_num::text, 6, '0');

  -- Insert the work order folder
  INSERT INTO files (name, path, folder_id, type, uploaded_by, property_id, job_id)
  VALUES ('WO-' || LPAD(NEW.work_order_num::text, 6, '0'), work_order_folder_path, property_folder_id, 'folder/directory', v_user_id, NEW.property_id, NEW.id)
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    uploaded_by = EXCLUDED.uploaded_by,
    property_id = EXCLUDED.property_id,
    job_id = EXCLUDED.job_id;

  RAISE NOTICE 'Created work order folder: %', work_order_folder_path;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_work_order_folder
AFTER INSERT ON jobs
FOR EACH ROW
EXECUTE FUNCTION create_work_order_folder();

-- Create or replace the create_job function
CREATE OR REPLACE FUNCTION create_job(
  p_property_id uuid,
  p_unit_number text,
  p_unit_size_id uuid,
  p_job_type_id uuid,
  p_description text,
  p_scheduled_date date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_job_phase_id uuid;
  v_job_details json;
  v_user_id uuid;
BEGIN
  -- Try to get the current user ID, fall back to system user if not available
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    -- Get the first admin user as system user
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE role = 'admin' 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF v_user_id IS NULL THEN
      -- If no admin user found, try to get any user
      SELECT id INTO v_user_id 
      FROM auth.users 
      ORDER BY created_at ASC 
      LIMIT 1;
      
      IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No system user found for job creation';
      END IF;
    END IF;
  END;

  -- Get the "Job Request" phase ID
  SELECT id INTO v_job_phase_id
  FROM job_phases
  WHERE job_phase_label = 'Job Request';

  IF v_job_phase_id IS NULL THEN
    RAISE EXCEPTION 'Job Request phase not found';
  END IF;

  -- Insert the job
  INSERT INTO jobs (
    property_id,
    unit_number,
    unit_size_id,
    job_type_id,
    description,
    scheduled_date,
    created_by,
    status,
    current_phase_id
  ) VALUES (
    p_property_id,
    p_unit_number,
    p_unit_size_id,
    p_job_type_id,
    p_description,
    p_scheduled_date,
    v_user_id,
    'Open',
    v_job_phase_id
  )
  RETURNING id INTO v_job_id;

  -- Create the initial phase change
  INSERT INTO job_phase_changes (
    job_id,
    changed_by,
    from_phase_id,
    to_phase_id,
    change_reason
  ) VALUES (
    v_job_id,
    v_user_id,
    NULL,
    v_job_phase_id,
    'Initial job request creation'
  );

  -- Get full job details
  SELECT json_build_object(
    'id', j.id,
    'work_order_num', j.work_order_num,
    'status', j.status,
    'property', json_build_object(
      'id', p.id,
      'name', p.property_name,
      'address', p.address,
      'address_2', p.address_2,
      'city', p.city,
      'state', p.state,
      'zip', p.zip
    ),
    'unit_number', j.unit_number,
    'unit_size', json_build_object(
      'id', us.id,
      'label', us.unit_size_label
    ),
    'job_type', json_build_object(
      'id', jt.id,
      'label', jt.job_type_label
    ),
    'description', j.description,
    'scheduled_date', j.scheduled_date,
    'created_at', j.created_at,
    'job_phase', json_build_object(
      'id', jp.id,
      'label', jp.job_phase_label,
      'color_light_mode', jp.color_light_mode,
      'color_dark_mode', jp.color_dark_mode
    )
  ) INTO v_job_details
  FROM jobs j
  JOIN properties p ON p.id = j.property_id
  JOIN unit_sizes us ON us.id = j.unit_size_id
  JOIN job_types jt ON jt.id = j.job_type_id
  JOIN job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = v_job_id;

  RETURN v_job_details;
END;
$$;

-- Create a function to manually create property folders for existing properties
CREATE OR REPLACE FUNCTION create_folders_for_existing_properties()
RETURNS void AS $$
DECLARE
  v_property RECORD;
  v_user_id uuid;
BEGIN
  -- Get the first admin user as system user
  SELECT id INTO v_user_id FROM auth.users WHERE role = 'admin' LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No system user found for folder creation';
  END IF;

  FOR v_property IN SELECT * FROM properties LOOP
    -- Check if folder already exists
    IF NOT EXISTS (
      SELECT 1 FROM files 
      WHERE property_id = v_property.id 
      AND type = 'folder/directory' 
      AND folder_id IS NULL
    ) THEN
      -- Create the property folder
      INSERT INTO files (name, path, folder_id, type, uploaded_by, property_id)
      VALUES (
        v_property.property_name,
        '/' || v_property.property_name,
        NULL,
        'folder/directory',
        v_user_id,
        v_property.id
      )
      ON CONFLICT (path) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        uploaded_by = EXCLUDED.uploaded_by,
        property_id = EXCLUDED.property_id;

      RAISE NOTICE 'Created folder for existing property: %', v_property.property_name;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to create folders for existing properties
SELECT create_folders_for_existing_properties(); 