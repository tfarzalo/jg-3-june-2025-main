-- Unify File Manager storage paths + categories (UUID-based, non-destructive)

-- 1) Extend files schema (non-destructive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE files ADD COLUMN storage_path TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'original_filename'
  ) THEN
    ALTER TABLE files ADD COLUMN original_filename TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'bucket'
  ) THEN
    ALTER TABLE files ADD COLUMN bucket TEXT DEFAULT 'files';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'files' AND column_name = 'work_order_id'
  ) THEN
    ALTER TABLE files ADD COLUMN work_order_id UUID REFERENCES work_orders(id);
  END IF;
END $$;

-- 2) Normalize legacy categories to canonical values
UPDATE files SET category = 'before_images' WHERE category = 'before';
UPDATE files SET category = 'sprinkler_images' WHERE category = 'sprinkler';
UPDATE files SET category = 'other_files' WHERE category = 'other';

-- 3) Update category constraint (canonical only)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'files_category_check') THEN
    ALTER TABLE files DROP CONSTRAINT files_category_check;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_category') THEN
    ALTER TABLE files DROP CONSTRAINT valid_category;
  END IF;
END $$;

ALTER TABLE files
  ADD CONSTRAINT files_category_check
  CHECK (category IS NULL OR category IN (
    'property_files',
    'job_files',
    'before',
    'sprinkler',
    'other',
    'before_images',
    'sprinkler_images',
    'other_files'
  ));

CREATE INDEX IF NOT EXISTS idx_files_work_order_id ON files(work_order_id);
CREATE INDEX IF NOT EXISTS idx_files_category ON files(category);

-- 4) Helper for canonical storage base
CREATE OR REPLACE FUNCTION canonical_property_path(p_property_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'properties/' || p_property_id::text;
$$;

-- 5) Update property folder structure to UUID-based paths (display names unchanged)
CREATE OR REPLACE FUNCTION create_property_folder_structure(p_property_id UUID, p_property_name TEXT)
RETURNS TABLE(
  property_folder_id UUID,
  work_orders_folder_id UUID,
  property_files_folder_id UUID
) AS $$
DECLARE
  v_property_folder_id UUID;
  v_work_orders_folder_id UUID;
  v_property_files_folder_id UUID;
  v_user_id UUID;
  v_storage_base TEXT;
  v_display_base TEXT;
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

  v_storage_base := canonical_property_path(p_property_id);
  v_display_base := '/Properties/' || p_property_name;

  -- Property root folder (reuse if exists)
  SELECT id INTO v_property_folder_id
  FROM files
  WHERE property_id = p_property_id
    AND folder_id IS NULL
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  IF v_property_folder_id IS NULL THEN
    INSERT INTO files (
      name, path, storage_path, display_path, type, uploaded_by, property_id, folder_id, size
    ) VALUES (
      p_property_name,
      v_storage_base,
      v_storage_base,
      v_display_base,
      'folder/directory',
      v_user_id,
      p_property_id,
      NULL,
      0
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      property_id = EXCLUDED.property_id,
      display_path = COALESCE(files.display_path, EXCLUDED.display_path),
      storage_path = COALESCE(files.storage_path, EXCLUDED.storage_path)
    RETURNING id INTO v_property_folder_id;
  ELSE
    UPDATE files
    SET
      name = p_property_name,
      display_path = COALESCE(display_path, v_display_base),
      storage_path = COALESCE(storage_path, path)
    WHERE id = v_property_folder_id;
  END IF;

  -- Work Orders folder
  SELECT id INTO v_work_orders_folder_id
  FROM files
  WHERE property_id = p_property_id
    AND name = 'Work Orders'
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  IF v_work_orders_folder_id IS NULL THEN
    INSERT INTO files (
      name, path, storage_path, display_path, type, uploaded_by, property_id, folder_id, size
    ) VALUES (
      'Work Orders',
      v_storage_base || '/work-orders',
      v_storage_base || '/work-orders',
      v_display_base || '/Work Orders',
      'folder/directory',
      v_user_id,
      p_property_id,
      v_property_folder_id,
      0
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      property_id = EXCLUDED.property_id,
      folder_id = EXCLUDED.folder_id,
      display_path = COALESCE(files.display_path, EXCLUDED.display_path),
      storage_path = COALESCE(files.storage_path, EXCLUDED.storage_path)
    RETURNING id INTO v_work_orders_folder_id;
  ELSE
    UPDATE files
    SET
      display_path = COALESCE(display_path, v_display_base || '/Work Orders'),
      storage_path = COALESCE(storage_path, path)
    WHERE id = v_work_orders_folder_id;
  END IF;

  -- Property Files folder
  SELECT id INTO v_property_files_folder_id
  FROM files
  WHERE property_id = p_property_id
    AND name = 'Property Files'
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  IF v_property_files_folder_id IS NULL THEN
    INSERT INTO files (
      name, path, storage_path, display_path, type, uploaded_by, property_id, folder_id, size
    ) VALUES (
      'Property Files',
      v_storage_base || '/property-files',
      v_storage_base || '/property-files',
      v_display_base || '/Property Files',
      'folder/directory',
      v_user_id,
      p_property_id,
      v_property_folder_id,
      0
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      property_id = EXCLUDED.property_id,
      folder_id = EXCLUDED.folder_id,
      display_path = COALESCE(files.display_path, EXCLUDED.display_path),
      storage_path = COALESCE(files.storage_path, EXCLUDED.storage_path)
    RETURNING id INTO v_property_files_folder_id;
  ELSE
    UPDATE files
    SET
      display_path = COALESCE(display_path, v_display_base || '/Property Files'),
      storage_path = COALESCE(storage_path, path)
    WHERE id = v_property_files_folder_id;
  END IF;

  RETURN QUERY SELECT v_property_folder_id, v_work_orders_folder_id, v_property_files_folder_id;
END;
$$ LANGUAGE plpgsql;

-- 6) Work order folder creation with Job Files + UUID-based paths
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

  IF v_work_order_id IS NULL THEN
    v_work_order_id := p_job_id;
  END IF;

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
      v_storage_base || '/work-orders/' || v_work_order_id::text,
      v_storage_base || '/work-orders/' || v_work_order_id::text,
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
      storage_path = COALESCE(storage_path, path)
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
      v_storage_base || '/work-orders/' || v_work_order_id::text || '/job-files',
      v_storage_base || '/work-orders/' || v_work_order_id::text || '/job-files',
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
      v_storage_base || '/work-orders/' || v_work_order_id::text || '/before-images',
      v_storage_base || '/work-orders/' || v_work_order_id::text || '/before-images',
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
      v_storage_base || '/work-orders/' || v_work_order_id::text || '/sprinkler-images',
      v_storage_base || '/work-orders/' || v_work_order_id::text || '/sprinkler-images',
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
      v_storage_base || '/work-orders/' || v_work_order_id::text || '/other-files',
      v_storage_base || '/work-orders/' || v_work_order_id::text || '/other-files',
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

-- 7) Update get_upload_folder to support canonical categories (incl. job_files)
CREATE OR REPLACE FUNCTION get_upload_folder(
  p_property_id UUID,
  p_job_id UUID DEFAULT NULL,
  p_folder_type TEXT DEFAULT 'other_files'
)
RETURNS UUID AS $$
DECLARE
  v_property_name TEXT;
  v_folder_id UUID;
  v_work_order_num TEXT;
  v_wo_folder_id UUID;
  v_job_files_folder_id UUID;
  v_before_folder_id UUID;
  v_sprinkler_folder_id UUID;
  v_other_folder_id UUID;
  v_effective_type TEXT;
BEGIN
  v_effective_type := CASE LOWER(p_folder_type)
    WHEN 'before' THEN 'before_images'
    WHEN 'sprinkler' THEN 'sprinkler_images'
    WHEN 'other' THEN 'other_files'
    WHEN 'job_files' THEN 'job_files'
    WHEN 'property_files' THEN 'property_files'
    ELSE LOWER(p_folder_type)
  END;

  SELECT property_name INTO v_property_name
  FROM properties
  WHERE id = p_property_id;

  IF v_property_name IS NULL THEN
    RAISE EXCEPTION 'Property not found: %', p_property_id;
  END IF;

  IF p_job_id IS NULL THEN
    SELECT id INTO v_folder_id
    FROM files
    WHERE property_id = p_property_id
      AND name = 'Property Files'
      AND type = 'folder/directory'
    ORDER BY created_at
    LIMIT 1;

    IF v_folder_id IS NULL THEN
      SELECT property_files_folder_id
      INTO v_folder_id
      FROM create_property_folder_structure(p_property_id, v_property_name);
    END IF;

    RETURN v_folder_id;
  END IF;

  SELECT work_order_num INTO v_work_order_num
  FROM jobs
  WHERE id = p_job_id;

  IF v_work_order_num IS NULL THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;

  SELECT
    wo_folder_id,
    job_files_folder_id,
    before_images_folder_id,
    sprinkler_images_folder_id,
    other_files_folder_id
  INTO
    v_wo_folder_id,
    v_job_files_folder_id,
    v_before_folder_id,
    v_sprinkler_folder_id,
    v_other_folder_id
  FROM create_work_order_folder_structure(
    p_property_id,
    v_property_name,
    v_work_order_num::TEXT,
    p_job_id
  );

  IF v_effective_type = 'job_files' THEN
    v_folder_id := v_job_files_folder_id;
  ELSIF v_effective_type = 'before_images' THEN
    v_folder_id := v_before_folder_id;
  ELSIF v_effective_type = 'sprinkler_images' THEN
    v_folder_id := v_sprinkler_folder_id;
  ELSE
    v_folder_id := v_other_folder_id;
  END IF;

  IF v_folder_id IS NULL THEN
    RAISE EXCEPTION 'Upload folder could not be resolved for job %', p_job_id;
  END IF;

  RETURN v_folder_id;
END;
$$ LANGUAGE plpgsql;

-- 8) Rename folder should not rewrite storage paths (display only)
CREATE OR REPLACE FUNCTION rename_folder(
  p_folder_id UUID,
  p_new_name TEXT
)
RETURNS JSON AS $$
DECLARE
  v_old_name TEXT;
  v_old_display_path TEXT;
  v_new_display_path TEXT;
BEGIN
  SELECT name, display_path
  INTO v_old_name, v_old_display_path
  FROM files
  WHERE id = p_folder_id
    AND type LIKE 'folder/%';

  IF v_old_name IS NULL THEN
    RAISE EXCEPTION 'Folder not found: %', p_folder_id;
  END IF;

  v_new_display_path := v_old_display_path;
  IF v_old_display_path IS NOT NULL THEN
    v_new_display_path := regexp_replace(v_old_display_path, v_old_name || '$', p_new_name);
  END IF;

  UPDATE files
  SET
    name = p_new_name,
    display_path = v_new_display_path
  WHERE id = p_folder_id;

  -- Update children display_path only (no storage path mutation)
  IF v_old_display_path IS NOT NULL THEN
    UPDATE files
    SET display_path = REPLACE(display_path, v_old_display_path, v_new_display_path)
    WHERE display_path LIKE v_old_display_path || '%';
  END IF;

  RETURN json_build_object(
    'success', true,
    'old_display_path', v_old_display_path,
    'new_display_path', v_new_display_path
  );
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_upload_folder(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION rename_folder(UUID, TEXT) TO authenticated;
