-- Fix Work Order Folder Path Logic (v2 - Strict Property Folder Selection)
-- 
-- Problem: Previous logic could accidentally select a root-level property folder if one existed,
-- continuing the cycle of creating bad paths.
--
-- Solution:
-- 1. Strictly prefer property folders inside '/Properties/'.
-- 2. Fallback to any property folder if nested one not found (rare edge case).
-- 3. Ensure the constructed path uses the actual parent folder's path.

CREATE OR REPLACE FUNCTION create_job_folder()
RETURNS TRIGGER AS $$
DECLARE
  v_property_folder_id uuid;
  v_property_folder_path text;
  v_work_orders_folder_id uuid;
  v_job_folder_id uuid;
  v_work_order_num text;
  v_property_name text;
BEGIN
  -- Get property folder ID, path and name
  -- PRIORITIZE folders that are inside '/Properties/' to avoid grabbing root duplicates
  SELECT f.id, f.path, p.property_name 
  INTO v_property_folder_id, v_property_folder_path, v_property_name
  FROM files f
  JOIN properties p ON p.id = NEW.property_id
  WHERE f.property_id = NEW.property_id
    AND f.type = 'folder/property'
  ORDER BY 
    CASE WHEN f.path LIKE '/Properties/%' THEN 0 ELSE 1 END, -- Prefer nested
    LENGTH(f.path) DESC -- Prefer longer path (usually nested) as tiebreaker
  LIMIT 1;

  -- If property folder doesn't exist, we can't create job folder correctly
  IF v_property_folder_id IS NULL THEN
    RAISE NOTICE 'Property folder not found for property_id: %', NEW.property_id;
    RETURN NEW;
  END IF;

  -- Format work order number
  v_work_order_num := 'WO-' || LPAD(NEW.work_order_num::text, 6, '0');

  -- Create or get Work Orders folder under the CORRECT property folder path
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
    v_property_folder_path || '/Work Orders',
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
    WHERE path = v_property_folder_path || '/Work Orders'
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
    v_property_folder_path || '/Work Orders/' || v_work_order_num,
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

-- Ensure the trigger is active
DROP TRIGGER IF EXISTS create_job_folder_trigger ON jobs;
CREATE TRIGGER create_job_folder_trigger
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION create_job_folder();
