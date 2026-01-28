-- Allow uploads before a work_order exists by keeping work_order_id NULL
-- Use job_id only for path when work_order_id is not yet available.

DROP FUNCTION IF EXISTS create_work_order_folder_structure(UUID, TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION create_work_order_folder_structure(
  p_property_id UUID,
  p_property_name TEXT,
  p_work_order_num TEXT,
  p_job_id UUID
)
RETURNS TABLE(
  wo_folder_id UUID,
  job_files_folder_id UUID,
  before_images_folder_id UUID,
  sprinkler_images_folder_id UUID,
  other_files_folder_id UUID
) AS $$
DECLARE
  v_work_orders_folder_id UUID;
  v_wo_folder_id UUID;
  v_job_files_folder_id UUID;
  v_before_images_folder_id UUID;
  v_sprinkler_images_folder_id UUID;
  v_other_files_folder_id UUID;
  v_user_id UUID;
  v_wo_name TEXT;
  v_display_base TEXT;
  v_storage_base TEXT;
  v_work_order_id UUID;
  v_path_work_order_id UUID;
BEGIN
  BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found and no users available in auth.users table';
  END IF;

  v_display_base := '/Properties/' || p_property_name;
  v_storage_base := canonical_property_path(p_property_id);
  v_wo_name := 'WO-' || LPAD(p_work_order_num::TEXT, 6, '0');

  SELECT id INTO v_work_order_id
  FROM work_orders
  WHERE job_id = p_job_id
    AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  v_path_work_order_id := COALESCE(v_work_order_id, p_job_id);

  -- Ensure property folders exist
  PERFORM create_property_folder_structure(p_property_id, p_property_name);

  SELECT id INTO v_work_orders_folder_id
  FROM files
  WHERE property_id = p_property_id
    AND name = 'Work Orders'
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  IF v_work_orders_folder_id IS NULL THEN
    RAISE EXCEPTION 'Work Orders folder not found for property: % (ID: %)', p_property_name, p_property_id;
  END IF;

  -- Work order folder
  SELECT id INTO v_wo_folder_id
  FROM files
  WHERE property_id = p_property_id
    AND job_id = p_job_id
    AND name = v_wo_name
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  IF v_wo_folder_id IS NULL THEN
    INSERT INTO files (
      name, path, storage_path, display_path, type, uploaded_by, property_id, job_id, work_order_id, folder_id, size
    ) VALUES (
      v_wo_name,
      v_storage_base || '/work-orders/' || v_path_work_order_id::text,
      v_storage_base || '/work-orders/' || v_path_work_order_id::text,
      v_display_base || '/Work Orders/' || v_wo_name,
      'folder/directory',
      v_user_id,
      p_property_id,
      p_job_id,
      v_work_order_id,
      v_work_orders_folder_id,
      0
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      property_id = EXCLUDED.property_id,
      job_id = EXCLUDED.job_id,
      work_order_id = EXCLUDED.work_order_id,
      folder_id = EXCLUDED.folder_id,
      display_path = COALESCE(files.display_path, EXCLUDED.display_path),
      storage_path = COALESCE(files.storage_path, EXCLUDED.storage_path)
    RETURNING id INTO v_wo_folder_id;
  ELSE
    UPDATE files
    SET
      display_path = COALESCE(display_path, v_display_base || '/Work Orders/' || v_wo_name),
      storage_path = COALESCE(storage_path, path),
      work_order_id = COALESCE(files.work_order_id, v_work_order_id)
    WHERE id = v_wo_folder_id;
  END IF;

  -- Job Files
  SELECT id INTO v_job_files_folder_id
  FROM files
  WHERE folder_id = v_wo_folder_id
    AND name = 'Job Files'
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  IF v_job_files_folder_id IS NULL THEN
    INSERT INTO files (
      name, path, storage_path, display_path, type, uploaded_by, property_id, job_id, work_order_id, folder_id, size
    ) VALUES (
      'Job Files',
      v_storage_base || '/work-orders/' || v_path_work_order_id::text || '/job-files',
      v_storage_base || '/work-orders/' || v_path_work_order_id::text || '/job-files',
      v_display_base || '/Work Orders/' || v_wo_name || '/Job Files',
      'folder/directory',
      v_user_id,
      p_property_id,
      p_job_id,
      v_work_order_id,
      v_wo_folder_id,
      0
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      property_id = EXCLUDED.property_id,
      job_id = EXCLUDED.job_id,
      work_order_id = EXCLUDED.work_order_id,
      folder_id = EXCLUDED.folder_id,
      display_path = COALESCE(files.display_path, EXCLUDED.display_path),
      storage_path = COALESCE(files.storage_path, EXCLUDED.storage_path)
    RETURNING id INTO v_job_files_folder_id;
  END IF;

  -- Before Images
  SELECT id INTO v_before_images_folder_id
  FROM files
  WHERE folder_id = v_wo_folder_id
    AND name = 'Before Images'
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  IF v_before_images_folder_id IS NULL THEN
    INSERT INTO files (
      name, path, storage_path, display_path, type, uploaded_by, property_id, job_id, work_order_id, folder_id, size
    ) VALUES (
      'Before Images',
      v_storage_base || '/work-orders/' || v_path_work_order_id::text || '/before-images',
      v_storage_base || '/work-orders/' || v_path_work_order_id::text || '/before-images',
      v_display_base || '/Work Orders/' || v_wo_name || '/Before Images',
      'folder/directory',
      v_user_id,
      p_property_id,
      p_job_id,
      v_work_order_id,
      v_wo_folder_id,
      0
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      property_id = EXCLUDED.property_id,
      job_id = EXCLUDED.job_id,
      work_order_id = EXCLUDED.work_order_id,
      folder_id = EXCLUDED.folder_id,
      display_path = COALESCE(files.display_path, EXCLUDED.display_path),
      storage_path = COALESCE(files.storage_path, EXCLUDED.storage_path)
    RETURNING id INTO v_before_images_folder_id;
  END IF;

  -- Sprinkler Images
  SELECT id INTO v_sprinkler_images_folder_id
  FROM files
  WHERE folder_id = v_wo_folder_id
    AND name = 'Sprinkler Images'
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  IF v_sprinkler_images_folder_id IS NULL THEN
    INSERT INTO files (
      name, path, storage_path, display_path, type, uploaded_by, property_id, job_id, work_order_id, folder_id, size
    ) VALUES (
      'Sprinkler Images',
      v_storage_base || '/work-orders/' || v_path_work_order_id::text || '/sprinkler-images',
      v_storage_base || '/work-orders/' || v_path_work_order_id::text || '/sprinkler-images',
      v_display_base || '/Work Orders/' || v_wo_name || '/Sprinkler Images',
      'folder/directory',
      v_user_id,
      p_property_id,
      p_job_id,
      v_work_order_id,
      v_wo_folder_id,
      0
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      property_id = EXCLUDED.property_id,
      job_id = EXCLUDED.job_id,
      work_order_id = EXCLUDED.work_order_id,
      folder_id = EXCLUDED.folder_id,
      display_path = COALESCE(files.display_path, EXCLUDED.display_path),
      storage_path = COALESCE(files.storage_path, EXCLUDED.storage_path)
    RETURNING id INTO v_sprinkler_images_folder_id;
  END IF;

  -- Other Files
  SELECT id INTO v_other_files_folder_id
  FROM files
  WHERE folder_id = v_wo_folder_id
    AND name = 'Other Files'
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  IF v_other_files_folder_id IS NULL THEN
    INSERT INTO files (
      name, path, storage_path, display_path, type, uploaded_by, property_id, job_id, work_order_id, folder_id, size
    ) VALUES (
      'Other Files',
      v_storage_base || '/work-orders/' || v_path_work_order_id::text || '/other-files',
      v_storage_base || '/work-orders/' || v_path_work_order_id::text || '/other-files',
      v_display_base || '/Work Orders/' || v_wo_name || '/Other Files',
      'folder/directory',
      v_user_id,
      p_property_id,
      p_job_id,
      v_work_order_id,
      v_wo_folder_id,
      0
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      property_id = EXCLUDED.property_id,
      job_id = EXCLUDED.job_id,
      work_order_id = EXCLUDED.work_order_id,
      folder_id = EXCLUDED.folder_id,
      display_path = COALESCE(files.display_path, EXCLUDED.display_path),
      storage_path = COALESCE(files.storage_path, EXCLUDED.storage_path)
    RETURNING id INTO v_other_files_folder_id;
  END IF;

  RETURN QUERY SELECT v_wo_folder_id, v_job_files_folder_id, v_before_images_folder_id, v_sprinkler_images_folder_id, v_other_files_folder_id;
END;
$$ LANGUAGE plpgsql;
