-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS create_work_order_folders_trigger ON work_orders;
DROP FUNCTION IF EXISTS create_work_order_folders();
DROP FUNCTION IF EXISTS create_folders_for_existing_work_orders();
DROP TRIGGER IF EXISTS update_work_orders_updated_at ON work_orders;
DROP FUNCTION IF EXISTS update_work_orders_updated_at();

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
  -- Get property name from properties and work order number from jobs
  SELECT
    p.property_name,
    LPAD(j.work_order_num::text, 6, '0')
  INTO
    v_property_name,
    v_work_order_num
  FROM jobs j
  JOIN properties p ON p.id = j.property_id
  WHERE j.id = NEW.job_id;

  -- Use unit number directly from the work order
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

-- Create function to update work_orders updated_at timestamp
CREATE OR REPLACE FUNCTION update_work_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update work_orders updated_at timestamp
CREATE TRIGGER update_work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_work_orders_updated_at(); 