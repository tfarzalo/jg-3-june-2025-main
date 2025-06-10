/*
  # Add Path Constraint to Files Table

  1. Changes
    - Clean up duplicate root paths while preserving folder hierarchy
    - Add unique constraint on path column to prevent duplicate paths
    - This is needed for ON CONFLICT clauses to work properly
*/

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS create_work_order_folders_trigger ON work_orders;
DROP FUNCTION IF EXISTS create_work_order_folders();
DROP FUNCTION IF EXISTS create_folders_for_existing_work_orders();

-- First, identify the root path we want to keep (the oldest one)
WITH root_paths AS (
  SELECT id, path, created_at,
         ROW_NUMBER() OVER (PARTITION BY path ORDER BY created_at) as rn
  FROM files
  WHERE path = '/'
),
keep_root AS (
  SELECT id FROM root_paths WHERE rn = 1
),
duplicate_roots AS (
  SELECT id FROM root_paths WHERE rn > 1
)
-- Update all references to duplicate roots to point to the root we're keeping
UPDATE files
SET folder_id = (SELECT id FROM keep_root)
WHERE folder_id IN (SELECT id FROM duplicate_roots);

-- Now we can safely delete the duplicate roots
DELETE FROM files
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY path ORDER BY created_at) as rn
    FROM files
    WHERE path = '/'
  ) dups
  WHERE rn > 1
);

-- Drop existing constraint if it exists
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_path_key;

-- Add unique constraint on path column
ALTER TABLE files
ADD CONSTRAINT files_path_key UNIQUE (path);

-- Create function to handle automatic folder creation for work orders
CREATE OR REPLACE FUNCTION create_work_order_folders()
RETURNS TRIGGER AS $$
DECLARE
  v_job_folder_id uuid;
  v_work_order_folder_id uuid;
  v_work_orders_folder_id uuid;
  v_sprinklers_folder_id uuid;
BEGIN
  -- Get job folder ID
  SELECT id INTO v_job_folder_id
  FROM files
  WHERE job_id = NEW.job_id
    AND type = 'folder/job';

  -- Create Work Orders folder under job folder if it doesn't exist
  INSERT INTO files (
    name,
    path,
    size,
    type,
    uploaded_by,
    job_id,
    folder_id
  ) VALUES (
    'Work Orders',
    '/' || (SELECT property_name FROM properties WHERE id = (SELECT property_id FROM jobs WHERE id = NEW.job_id)) || 
    '/' || 'WO-' || LPAD((SELECT work_order_num FROM jobs WHERE id = NEW.job_id)::text, 6, '0') || 
    '/Work Orders',
    0,
    'folder/directory',
    auth.uid(),
    NEW.job_id,
    v_job_folder_id
  )
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    uploaded_by = EXCLUDED.uploaded_by,
    job_id = EXCLUDED.job_id,
    folder_id = EXCLUDED.folder_id
  RETURNING id INTO v_work_orders_folder_id;

  -- Create work order specific folder
  INSERT INTO files (
    name,
    path,
    size,
    type,
    uploaded_by,
    job_id,
    folder_id
  ) VALUES (
    'WO-' || LPAD((SELECT work_order_num FROM jobs WHERE id = NEW.job_id)::text, 6, '0'),
    '/' || (SELECT property_name FROM properties WHERE id = (SELECT property_id FROM jobs WHERE id = NEW.job_id)) || 
    '/' || 'WO-' || LPAD((SELECT work_order_num FROM jobs WHERE id = NEW.job_id)::text, 6, '0') || 
    '/Work Orders/WO-' || LPAD((SELECT work_order_num FROM jobs WHERE id = NEW.job_id)::text, 6, '0'),
    0,
    'folder/directory',
    auth.uid(),
    NEW.job_id,
    v_work_orders_folder_id
  )
  ON CONFLICT (path) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    uploaded_by = EXCLUDED.uploaded_by,
    job_id = EXCLUDED.job_id,
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
      folder_id
    ) VALUES (
      'Sprinklers',
      '/' || (SELECT property_name FROM properties WHERE id = (SELECT property_id FROM jobs WHERE id = NEW.job_id)) || 
      '/' || 'WO-' || LPAD((SELECT work_order_num FROM jobs WHERE id = NEW.job_id)::text, 6, '0') || 
      '/Work Orders/WO-' || LPAD((SELECT work_order_num FROM jobs WHERE id = NEW.job_id)::text, 6, '0') || 
      '/Sprinklers',
      0,
      'folder/directory',
      auth.uid(),
      NEW.job_id,
      v_work_order_folder_id
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      job_id = EXCLUDED.job_id,
      folder_id = EXCLUDED.folder_id
    RETURNING id INTO v_sprinklers_folder_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
  v_job_folder_id uuid;
BEGIN
  FOR v_work_order IN 
    SELECT wo.*, j.work_order_num, p.property_name
    FROM work_orders wo
    JOIN jobs j ON j.id = wo.job_id
    JOIN properties p ON p.id = j.property_id
  LOOP
    -- Get job folder ID
    SELECT id INTO v_job_folder_id
    FROM files
    WHERE job_id = v_work_order.job_id
      AND type = 'folder/job';

    -- Create Work Orders folder
    INSERT INTO files (
      name,
      path,
      size,
      type,
      uploaded_by,
      job_id,
      folder_id
    ) VALUES (
      'Work Orders',
      '/' || v_work_order.property_name || 
      '/' || 'WO-' || LPAD(v_work_order.work_order_num::text, 6, '0') || 
      '/Work Orders',
      0,
      'folder/directory',
      auth.uid(),
      v_work_order.job_id,
      v_job_folder_id
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      job_id = EXCLUDED.job_id,
      folder_id = EXCLUDED.folder_id;

    -- Create work order specific folder
    INSERT INTO files (
      name,
      path,
      size,
      type,
      uploaded_by,
      job_id,
      folder_id
    ) VALUES (
      'WO-' || LPAD(v_work_order.work_order_num::text, 6, '0'),
      '/' || v_work_order.property_name || 
      '/' || 'WO-' || LPAD(v_work_order.work_order_num::text, 6, '0') || 
      '/Work Orders/WO-' || LPAD(v_work_order.work_order_num::text, 6, '0'),
      0,
      'folder/directory',
      auth.uid(),
      v_work_order.job_id,
      (SELECT id FROM files WHERE path = '/' || v_work_order.property_name || 
      '/' || 'WO-' || LPAD(v_work_order.work_order_num::text, 6, '0') || 
      '/Work Orders')
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      job_id = EXCLUDED.job_id,
      folder_id = EXCLUDED.folder_id;

    -- Create Sprinklers folder if work order has sprinklers
    IF v_work_order.has_sprinklers THEN
      INSERT INTO files (
        name,
        path,
        size,
        type,
        uploaded_by,
        job_id,
        folder_id
      ) VALUES (
        'Sprinklers',
        '/' || v_work_order.property_name || 
        '/' || 'WO-' || LPAD(v_work_order.work_order_num::text, 6, '0') || 
        '/Work Orders/WO-' || LPAD(v_work_order.work_order_num::text, 6, '0') || 
        '/Sprinklers',
        0,
        'folder/directory',
        auth.uid(),
        v_work_order.job_id,
        (SELECT id FROM files WHERE path = '/' || v_work_order.property_name || 
        '/' || 'WO-' || LPAD(v_work_order.work_order_num::text, 6, '0') || 
        '/Work Orders/WO-' || LPAD(v_work_order.work_order_num::text, 6, '0'))
      )
      ON CONFLICT (path) DO UPDATE SET
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        uploaded_by = EXCLUDED.uploaded_by,
        job_id = EXCLUDED.job_id,
        folder_id = EXCLUDED.folder_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to create folders for existing work orders
SELECT create_folders_for_existing_work_orders(); 