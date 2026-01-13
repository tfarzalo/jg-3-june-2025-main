/*
  # Fix Job Folder Creation to Use Work Orders Subfolder

  1. Problem
    - create_job_folder creates WO-000001 directly under property: /{PropertyName}/WO-000001
    - create_work_order_folders creates WO-000001 under Work Orders: /{PropertyName}/Work Orders/WO-000001
    - This creates duplicate folders in different locations

  2. Solution
    - Update create_job_folder to create Work Orders subfolder first (if not exists)
    - Create WO-000001 folder under Work Orders subfolder
    - This ensures job request and work order submission use the same folder
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS create_job_folder_trigger ON jobs;
DROP FUNCTION IF EXISTS create_job_folder();

-- Create updated function that creates folders under Work Orders subfolder
CREATE OR REPLACE FUNCTION create_job_folder()
RETURNS TRIGGER AS $$
DECLARE
  v_property_folder_id uuid;
  v_work_orders_folder_id uuid;
  v_job_folder_id uuid;
  v_work_order_num text;
  v_property_name text;
BEGIN
  -- Get property folder ID and name
  SELECT f.id, p.property_name INTO v_property_folder_id, v_property_name
  FROM files f
  JOIN properties p ON p.id = NEW.property_id
  WHERE f.property_id = NEW.property_id
    AND f.type = 'folder/property'
  LIMIT 1;

  -- If property folder doesn't exist, we can't create job folder
  IF v_property_folder_id IS NULL THEN
    RAISE NOTICE 'Property folder not found for property_id: %', NEW.property_id;
    RETURN NEW;
  END IF;

  -- Format work order number
  v_work_order_num := 'WO-' || LPAD(NEW.work_order_num::text, 6, '0');

  -- Create or get Work Orders folder under property folder
  INSERT INTO files (
    name,
    path,
    size,
    type,
    uploaded_by,
    property_id,
    folder_id
  ) VALUES (
    'Work Orders',
    '/' || v_property_name || '/Work Orders',
    0,
    'folder/directory',
    COALESCE(auth.uid(), NEW.created_by),
    NEW.property_id,
    v_property_folder_id
  )
  ON CONFLICT (path) DO NOTHING
  RETURNING id INTO v_work_orders_folder_id;

  -- Get Work Orders folder ID if it already existed
  IF v_work_orders_folder_id IS NULL THEN
    SELECT id INTO v_work_orders_folder_id
    FROM files
    WHERE path = '/' || v_property_name || '/Work Orders'
      AND type = 'folder/directory';
  END IF;

  -- Create job folder under Work Orders folder
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
    '/' || v_property_name || '/Work Orders/' || v_work_order_num,
    0,
    'folder/job',
    COALESCE(auth.uid(), NEW.created_by),
    NEW.property_id,
    NEW.id,
    v_work_orders_folder_id
  )
  ON CONFLICT (path) DO NOTHING
  RETURNING id INTO v_job_folder_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger for job folder creation
CREATE TRIGGER create_job_folder_trigger
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION create_job_folder();

-- Migration to fix existing misplaced WO folders
-- Move any WO-* folders from /{PropertyName}/WO-* to /{PropertyName}/Work Orders/WO-*
DO $$
DECLARE
  v_wo_folder RECORD;
  v_property_name text;
  v_work_orders_folder_id uuid;
  v_new_path text;
BEGIN
  -- Find all WO folders that are directly under property (not under Work Orders)
  FOR v_wo_folder IN
    SELECT f.*, p.property_name
    FROM files f
    JOIN properties p ON p.id = f.property_id
    WHERE f.type IN ('folder/job', 'folder/directory')
      AND f.name LIKE 'WO-%'
      AND f.path LIKE '/%'
      AND f.path NOT LIKE '%/Work Orders/%'
      AND f.folder_id IN (
        SELECT id FROM files WHERE type = 'folder/property'
      )
  LOOP
    v_property_name := v_wo_folder.property_name;

    -- Create or get Work Orders folder
    INSERT INTO files (
      name,
      path,
      size,
      type,
      uploaded_by,
      property_id,
      folder_id
    ) VALUES (
      'Work Orders',
      '/' || v_property_name || '/Work Orders',
      0,
      'folder/directory',
      v_wo_folder.uploaded_by,
      v_wo_folder.property_id,
      v_wo_folder.folder_id  -- parent is the property folder
    )
    ON CONFLICT (path) DO NOTHING
    RETURNING id INTO v_work_orders_folder_id;

    -- Get Work Orders folder ID if it already existed
    IF v_work_orders_folder_id IS NULL THEN
      SELECT id INTO v_work_orders_folder_id
      FROM files
      WHERE path = '/' || v_property_name || '/Work Orders'
        AND type = 'folder/directory';
    END IF;

    -- Update the WO folder path and folder_id
    v_new_path := '/' || v_property_name || '/Work Orders/' || v_wo_folder.name;

    UPDATE files
    SET
      path = v_new_path,
      folder_id = v_work_orders_folder_id
    WHERE id = v_wo_folder.id;

    -- Update all subfolders and files under this WO folder
    UPDATE files
    SET path = REPLACE(path, v_wo_folder.path, v_new_path)
    WHERE path LIKE v_wo_folder.path || '/%';

    RAISE NOTICE 'Moved % from % to %', v_wo_folder.name, v_wo_folder.path, v_new_path;
  END LOOP;
END $$;
