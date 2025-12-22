-- Migration: Fix Work Orders folder creation to avoid root-level folder
-- Date: 2025-06-15

DROP FUNCTION IF EXISTS create_work_order_folders();

CREATE OR REPLACE FUNCTION create_work_order_folders()
RETURNS TRIGGER AS $$
DECLARE
  v_property_folder_id uuid;
  v_work_order_folder_id uuid;
  v_work_orders_folder_id uuid;
  v_sprinklers_folder_id uuid;
  v_property_id uuid;
BEGIN
  -- Get property_id for this job
  SELECT property_id INTO v_property_id FROM jobs WHERE id = NEW.job_id;

  -- Get property folder ID
  SELECT id INTO v_property_folder_id
  FROM files
  WHERE name = (SELECT property_name FROM properties WHERE id = v_property_id)
    AND type = 'folder/property';

  -- Only create Work Orders folder if property folder exists
  IF v_property_folder_id IS NOT NULL THEN
    INSERT INTO files (
      name,
      path,
      size,
      type,
      uploaded_by,
      job_id,
      property_id,
      folder_id
    ) VALUES (
      'Work Orders',
      '/' || (SELECT property_name FROM properties WHERE id = v_property_id) || '/Work Orders',
      0,
      'folder/directory',
      auth.uid(),
      NEW.job_id,
      v_property_id,
      v_property_folder_id
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      job_id = EXCLUDED.job_id,
      property_id = EXCLUDED.property_id,
      folder_id = EXCLUDED.folder_id
    RETURNING id INTO v_work_orders_folder_id;
  END IF;

  -- Create work order specific folder
  INSERT INTO files (
    name,
    path,
    size,
    type,
    uploaded_by,
    job_id,
    property_id,
    folder_id
  ) VALUES (
    'WO-' || LPAD((SELECT work_order_num FROM jobs WHERE id = NEW.job_id)::text, 6, '0'),
    '/' || (SELECT property_name FROM properties WHERE id = v_property_id) || '/Work Orders/WO-' || LPAD((SELECT work_order_num FROM jobs WHERE id = NEW.job_id)::text, 6, '0'),
    0,
    'folder/directory',
    auth.uid(),
    NEW.job_id,
    v_property_id,
    v_work_orders_folder_id
  )
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    uploaded_by = EXCLUDED.uploaded_by,
    job_id = EXCLUDED.job_id,
    property_id = EXCLUDED.property_id,
    folder_id = EXCLUDED.folder_id
  RETURNING id INTO v_work_order_folder_id;

  -- Create Sprinklers folder if work order has sprinklers
  IF NEW.has_sprinklers THEN
    INSERT INTO files (
      name,
      path,
      size,
      type,
      uploaded_by,
      job_id,
      property_id,
      folder_id
    ) VALUES (
      'Sprinklers',
      '/' || (SELECT property_name FROM properties WHERE id = v_property_id) || '/Work Orders/WO-' || LPAD((SELECT work_order_num FROM jobs WHERE id = NEW.job_id)::text, 6, '0') || '/Sprinklers',
      0,
      'folder/directory',
      auth.uid(),
      NEW.job_id,
      v_property_id,
      v_work_order_folder_id
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      job_id = EXCLUDED.job_id,
      property_id = EXCLUDED.property_id,
      folder_id = EXCLUDED.folder_id
    RETURNING id INTO v_sprinklers_folder_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger if needed
DROP TRIGGER IF EXISTS create_work_order_folders_trigger ON work_orders;
CREATE TRIGGER create_work_order_folders_trigger
  AFTER INSERT ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION create_work_order_folders();
