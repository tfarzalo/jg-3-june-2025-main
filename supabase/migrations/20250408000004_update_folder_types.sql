/*
  # Update Folder Types

  1. Changes
    - Update all folder types to folder/directory
    - This ensures consistency with the latest folder type changes
*/

-- Update all folder types to folder/directory
UPDATE files
SET type = 'folder/directory'
WHERE type IN ('folder/property', 'folder/job', 'folder/work_orders', 'folder/work_order', 'folder/sprinklers');

-- Update the property folder creation function
CREATE OR REPLACE FUNCTION create_property_folder()
RETURNS TRIGGER AS $$
DECLARE
  v_folder_id uuid;
BEGIN
  -- Create root folder for property
  INSERT INTO files (
    name,
    path,
    size,
    type,
    uploaded_by,
    property_id
  ) VALUES (
    NEW.property_name,
    '/' || NEW.property_name,
    0,
    'folder/directory',
    auth.uid(),
    NEW.id
  ) RETURNING id INTO v_folder_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the job folder creation function
CREATE OR REPLACE FUNCTION create_job_folder()
RETURNS TRIGGER AS $$
DECLARE
  v_property_folder_id uuid;
  v_job_folder_id uuid;
  v_work_order_num text;
BEGIN
  -- Get property folder ID
  SELECT id INTO v_property_folder_id
  FROM files
  WHERE property_id = NEW.property_id
    AND type = 'folder/directory';

  -- Format work order number
  v_work_order_num := 'WO-' || LPAD(NEW.work_order_num::text, 6, '0');

  -- Create job folder under property folder
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
    '/' || (SELECT property_name FROM properties WHERE id = NEW.property_id) || '/' || v_work_order_num,
    0,
    'folder/directory',
    auth.uid(),
    NEW.property_id,
    NEW.id,
    v_property_folder_id
  ) RETURNING id INTO v_job_folder_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql; 