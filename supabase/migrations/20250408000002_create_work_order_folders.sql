/*
  # Create Work Order Folders

  1. Changes
    - Create a function to automatically create work order folders
    - Create a trigger to create folders when a work order is created
    - Create a function to handle folder creation for existing work orders
*/

-- Drop existing objects if they exist
DROP TRIGGER IF EXISTS create_work_order_folders_trigger ON work_orders;
DROP FUNCTION IF EXISTS create_work_order_folders();
DROP FUNCTION IF EXISTS create_folders_for_existing_work_orders();

-- Create function to handle automatic folder creation for work orders
CREATE OR REPLACE FUNCTION public.create_work_order_folders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_property_name TEXT;
  v_unit_number TEXT;
  v_folder_base TEXT;
  v_property_unit_folder_id UUID;
  v_work_orders_folder_id UUID;
  v_work_order_folder_id UUID;
  v_work_order_num TEXT;
BEGIN
  -- Get property name from properties, unit number from work_orders, and work order number from jobs
  SELECT
    p.property_name,
    LPAD(j.work_order_num::text, 6, '0')
  INTO
    v_property_name,
    v_work_order_num
  FROM jobs j
  JOIN properties p ON p.id = j.property_id
  WHERE j.id = NEW.job_id;

  v_unit_number := NEW.unit_number;

  -- Build base folder name (Property Name Unit Number)
  v_folder_base := v_property_name || ' ' || v_unit_number;

  -- Find or Create Property/Unit folder
  INSERT INTO files (
      name,
      type,
      path,
      uploaded_by,
      job_id,
      folder_id
  )
  VALUES (
      v_folder_base,
      'folder/directory',
      '/' || v_folder_base,
      auth.uid(),
      NEW.job_id,
      NULL -- Root level folder
  )
  ON CONFLICT (path) DO NOTHING
  RETURNING id INTO v_property_unit_folder_id;

  -- Get property/unit folder ID if it already existed
  IF v_property_unit_folder_id IS NULL THEN
      SELECT id INTO v_property_unit_folder_id
      FROM files
      WHERE path = '/' || v_folder_base;
  END IF;

  -- Find or Create Work Orders folder under Property/Unit folder
  INSERT INTO files (
      name,
      type,
      path,
      uploaded_by,
      job_id,
      folder_id
  )
  VALUES (
      'Work Orders',
      'folder/directory',
      '/' || v_folder_base || '/Work Orders',
      auth.uid(),
      NEW.job_id,
      v_property_unit_folder_id -- Parent is the Property/Unit folder
  )
  ON CONFLICT (path) DO NOTHING
  RETURNING id INTO v_work_orders_folder_id;

  -- Get Work Orders folder ID if it already existed
  IF v_work_orders_folder_id IS NULL THEN
      SELECT id INTO v_work_orders_folder_id
      FROM files
      WHERE path = '/' || v_folder_base || '/Work Orders';
  END IF;

  -- Create Work Order specific folder under Work Orders folder
  INSERT INTO files (
      name,
      type,
      path,
      uploaded_by,
      job_id,
      folder_id
  )
  VALUES (
      'WO-' || v_work_order_num,
      'folder/directory',
      '/' || v_folder_base || '/Work Orders/WO-' || v_work_order_num,
      auth.uid(),
      NEW.job_id,
      v_work_orders_folder_id -- Parent is the Work Orders folder
  )
  ON CONFLICT (path) DO NOTHING
  RETURNING id INTO v_work_order_folder_id;

  -- Get Work Order folder ID if it already existed
  IF v_work_order_folder_id IS NULL THEN
      SELECT id INTO v_work_order_folder_id
      FROM files
      WHERE path = '/' || v_folder_base || '/Work Orders/WO-' || v_work_order_num;
  END IF;

  -- Create Sprinklers folder if needed, under Work Order folder
  IF NEW.has_sprinklers THEN
      INSERT INTO files (
          name,
          type,
          path,
          uploaded_by,
          job_id,
          folder_id
      )
      VALUES (
          'Sprinklers',
          'folder/directory',
          '/' || v_folder_base || '/Work Orders/WO-' || v_work_order_num || '/Sprinklers',
          auth.uid(),
          NEW.job_id,
          v_work_order_folder_id -- Parent is the Work Order folder
      )
      ON CONFLICT (path) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for work order folder creation
CREATE TRIGGER create_work_order_folders_trigger
  AFTER INSERT ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION create_work_order_folders();

-- Create function to handle folder creation for existing work orders
CREATE OR REPLACE FUNCTION create_folders_for_existing_work_orders()
RETURNS void AS $$
DECLARE
  v_work_order RECORD;
  v_folder_base TEXT;
  v_property_unit_folder_id UUID;
  v_work_orders_folder_id UUID;
  v_work_order_folder_id UUID;
BEGIN
  FOR v_work_order IN 
    SELECT 
        wo.*,
        j.work_order_num,
        p.property_name,
        j.id as job_id -- Select job_id
    FROM work_orders wo
    JOIN jobs j ON j.id = wo.job_id
    JOIN properties p ON p.id = j.property_id
  LOOP
    -- Build base folder name (Property Name Unit Number)
    v_folder_base := v_work_order.property_name || ' ' || v_work_order.unit_number;

    -- Find or Create Property/Unit folder
    INSERT INTO files (
        name,
        type,
        path,
        uploaded_by,
        job_id,
        folder_id
    )
    VALUES (
        v_folder_base,
        'folder/directory',
        '/' || v_folder_base,
        auth.uid(),
        v_work_order.job_id,
        NULL -- Root level folder
    )
    ON CONFLICT (path) DO NOTHING
    RETURNING id INTO v_property_unit_folder_id;

    -- Get property/unit folder ID if it already existed
    IF v_property_unit_folder_id IS NULL THEN
        SELECT id INTO v_property_unit_folder_id
        FROM files
        WHERE path = '/' || v_folder_base;
    END IF;

    -- Find or Create Work Orders folder under Property/Unit folder
    INSERT INTO files (
        name,
        type,
        path,
        uploaded_by,
        job_id,
        folder_id
    )
    VALUES (
        'Work Orders',
        'folder/directory',
        '/' || v_folder_base || '/Work Orders',
        auth.uid(),
        v_work_order.job_id,
        v_property_unit_folder_id -- Parent is the Property/Unit folder
    )
    ON CONFLICT (path) DO NOTHING
    RETURNING id INTO v_work_orders_folder_id;

    -- Get Work Orders folder ID if it already existed
    IF v_work_orders_folder_id IS NULL THEN
        SELECT id INTO v_work_orders_folder_id
        FROM files
        WHERE path = '/' || v_folder_base || '/Work Orders';
    END IF;

    -- Create Work Order specific folder under Work Orders folder
    INSERT INTO files (
        name,
        type,
        path,
        uploaded_by,
        job_id,
        folder_id
    )
    VALUES (
        'WO-' || LPAD(v_work_order.work_order_num::text, 6, '0'),
        'folder/directory',
        '/' || v_folder_base || '/Work Orders/WO-' || LPAD(v_work_order.work_order_num::text, 6, '0'),
        auth.uid(),
        v_work_order.job_id,
        v_work_orders_folder_id -- Parent is the Work Orders folder
    )
    ON CONFLICT (path) DO NOTHING
    RETURNING id INTO v_work_order_folder_id;

    -- Get Work Order folder ID if it already existed
    IF v_work_order_folder_id IS NULL THEN
        SELECT id INTO v_work_order_folder_id
        FROM files
        WHERE path = '/' || v_folder_base || '/Work Orders/WO-' || LPAD(v_work_order.work_order_num::text, 6, '0');
    END IF;

    -- Create Sprinklers folder if needed, under Work Order folder
    IF v_work_order.has_sprinklers THEN
        INSERT INTO files (
            name,
            type,
            path,
            uploaded_by,
            job_id,
            folder_id
        )
        VALUES (
            'Sprinklers',
            'folder/directory',
            '/' || v_folder_base || '/Work Orders/WO-' || LPAD(v_work_order.work_order_num::text, 6, '0') || '/Sprinklers',
            auth.uid(),
            v_work_order.job_id,
            v_work_order_folder_id -- Parent is the Work Order folder
        )
        ON CONFLICT (path) DO NOTHING;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function to create folders for existing work orders
-- This should be run *after* the main function and trigger are created
-- and likely as a separate migration or manual step if dealing with existing data.
-- For now, I've commented this out as the immediate goal is new work orders.
-- SELECT create_folders_for_existing_work_orders();

-- Check RLS policies for work_orders table
SELECT * FROM pg_policies WHERE tablename = 'work_orders';

-- Check the contents of the files table
SELECT id, name, path, folder_id, type FROM files;

-- Check if the trigger is enabled
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgrelid = 'public.work_orders'::regclass
  AND tgname = 'create_work_order_folders_trigger';

-- Check the function definition
SELECT pg_get_functiondef('public.create_work_order_folders'::regproc);

UPDATE files f
SET folder_id = parent_folder.id
FROM files parent_folder
WHERE f.type = 'folder/directory'
  AND f.name LIKE 'WO-%'
  AND parent_folder.type = 'folder/directory'
  AND parent_folder.name = 'Work Orders'
  AND f.path LIKE parent_folder.path || '/%'; -- Ensure the parent path is a prefix of the child path 

SELECT * FROM work_orders WHERE job_id = '432c2591-3342-4951-871c-fb9a58000593'; 