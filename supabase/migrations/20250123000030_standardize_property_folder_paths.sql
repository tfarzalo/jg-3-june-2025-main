-- Migration: Standardize property/work order folder paths
-- Purpose : Normalize apostrophes/special characters so uploads always reuse
--           the same property/work-order folders instead of creating variants.
-- Date    : 2025-01-23
-- ============================================================================

-- Make sure old versions are removed before redefining (prevents return-type conflicts)
DROP FUNCTION IF EXISTS get_upload_folder(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS create_work_order_folder_structure(UUID, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS create_property_folder_structure(UUID, TEXT);

-- Helper: normalize names for storage paths (removes apostrophes/quotes and
-- replaces non-alphanumeric characters with underscores).
CREATE OR REPLACE FUNCTION normalize_property_storage_name(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_clean TEXT;
BEGIN
    IF input_text IS NULL THEN
        RETURN '';
    END IF;

    v_clean := replace(input_text, '''', '');
    v_clean := replace(v_clean, '’', '');
    v_clean := regexp_replace(v_clean, '[^A-Za-z0-9 _-]', '_', 'g');
    v_clean := regexp_replace(v_clean, '_{2,}', '_', 'g');
    v_clean := regexp_replace(v_clean, '\\s{2,}', ' ', 'g');
    v_clean := trim(BOTH ' ' FROM trim(BOTH '_' FROM v_clean));

    IF v_clean = '' THEN
        v_clean := 'property_' || replace(gen_random_uuid()::TEXT, '-', '');
    END IF;

    RETURN v_clean;
END;
$$;

-- Alias kept for existing callers (e.g., rename_folder)
CREATE OR REPLACE FUNCTION sanitize_for_storage(input_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT normalize_property_storage_name(input_text);
$$;

GRANT EXECUTE ON FUNCTION normalize_property_storage_name(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sanitize_for_storage(TEXT) TO authenticated;

COMMENT ON FUNCTION normalize_property_storage_name(TEXT) IS 'Sanitize property names for storage paths (removes apostrophes, non-alphanumeric chars -> underscore, collapses repeats).';
COMMENT ON FUNCTION sanitize_for_storage(TEXT) IS 'Alias to normalize_property_storage_name for backward compatibility.';

-- ---------------------------------------------------------------------------
-- Canonical property folder creator
-- ---------------------------------------------------------------------------
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
  -- Resolve a user for audit fields
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

  v_storage_base := normalize_property_storage_name(p_property_name);
  v_display_base := '/' || p_property_name;

  -- Prefer an existing root folder by property_id (avoids duplicates when path differs)
  SELECT id
  INTO v_property_folder_id
  FROM files
  WHERE property_id = p_property_id
    AND folder_id IS NULL
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  -- Fallback to legacy path-based lookup
  IF v_property_folder_id IS NULL THEN
    SELECT id
    INTO v_property_folder_id
    FROM files
    WHERE path IN (
      '/' || p_property_name,
      '/' || v_storage_base,
      v_storage_base,
      p_property_name
    )
      AND folder_id IS NULL
      AND type = 'folder/directory'
    LIMIT 1;
  END IF;

  IF v_property_folder_id IS NULL THEN
    -- Create the root folder with sanitized storage path + friendly display path
    INSERT INTO files (
      name, path, storage_path, display_path, type, uploaded_by, property_id, folder_id, size
    ) VALUES (
      p_property_name,
      '/' || v_storage_base,
      '/' || v_storage_base,
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
    -- Ensure friendly metadata is populated when reusing an existing folder
    UPDATE files
    SET
      name = p_property_name,
      display_path = COALESCE(display_path, v_display_base),
      storage_path = COALESCE(storage_path, path)
    WHERE id = v_property_folder_id;
  END IF;

  -- Work Orders folder lookup by property_id first
  SELECT id
  INTO v_work_orders_folder_id
  FROM files
  WHERE property_id = p_property_id
    AND name = 'Work Orders'
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  IF v_work_orders_folder_id IS NULL THEN
    SELECT id
    INTO v_work_orders_folder_id
    FROM files
    WHERE path IN (
      '/' || v_storage_base || '/Work Orders',
      '/' || v_storage_base || '/Work_Orders',
      '/' || p_property_name || '/Work Orders'
    )
      AND type = 'folder/directory'
    LIMIT 1;
  END IF;

  IF v_work_orders_folder_id IS NULL THEN
    INSERT INTO files (
      name, path, storage_path, display_path, type, uploaded_by, property_id, folder_id, size
    ) VALUES (
      'Work Orders',
      '/' || v_storage_base || '/Work Orders',
      '/' || v_storage_base || '/Work Orders',
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

  -- Property Files folder lookup by property_id first
  SELECT id
  INTO v_property_files_folder_id
  FROM files
  WHERE property_id = p_property_id
    AND name = 'Property Files'
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  IF v_property_files_folder_id IS NULL THEN
    SELECT id
    INTO v_property_files_folder_id
    FROM files
    WHERE path IN (
      '/' || v_storage_base || '/Property Files',
      '/' || v_storage_base || '/Property_Files',
      '/' || p_property_name || '/Property Files'
    )
      AND type = 'folder/directory'
    LIMIT 1;
  END IF;

  IF v_property_files_folder_id IS NULL THEN
    INSERT INTO files (
      name, path, storage_path, display_path, type, uploaded_by, property_id, folder_id, size
    ) VALUES (
      'Property Files',
      '/' || v_storage_base || '/Property Files',
      '/' || v_storage_base || '/Property Files',
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

-- ---------------------------------------------------------------------------
-- Work order folder creation (uses normalized storage paths)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_work_order_folder_structure(
  p_property_id UUID,
  p_property_name TEXT,
  p_work_order_num TEXT,
  p_job_id UUID
)
RETURNS TABLE(
  wo_folder_id UUID,
  before_images_folder_id UUID,
  sprinkler_images_folder_id UUID,
  other_files_folder_id UUID
) AS $$
DECLARE
  v_work_orders_folder_id UUID;
  v_wo_folder_id UUID;
  v_before_images_folder_id UUID;
  v_sprinkler_images_folder_id UUID;
  v_other_files_folder_id UUID;
  v_user_id UUID;
  v_wo_name TEXT;
  v_sanitized_property TEXT;
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

  v_sanitized_property := normalize_property_storage_name(p_property_name);
  v_display_base := '/' || p_property_name;
  v_wo_name := 'WO-' || LPAD(p_work_order_num::TEXT, 6, '0');

  -- Ensure property folders exist and reuse the Work Orders folder by property_id
  PERFORM create_property_folder_structure(p_property_id, p_property_name);

  SELECT id
  INTO v_work_orders_folder_id
  FROM files
  WHERE property_id = p_property_id
    AND name = 'Work Orders'
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  IF v_work_orders_folder_id IS NULL THEN
    SELECT id
    INTO v_work_orders_folder_id
    FROM files
    WHERE path IN (
      '/' || v_sanitized_property || '/Work Orders',
      '/' || v_sanitized_property || '/Work_Orders',
      '/' || p_property_name || '/Work Orders'
    )
      AND type = 'folder/directory'
    LIMIT 1;
  END IF;

  IF v_work_orders_folder_id IS NULL THEN
    RAISE EXCEPTION 'Work Orders folder not found for property: % (ID: %)', p_property_name, p_property_id;
  END IF;

  -- Reuse an existing work order folder if the job already has one
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
      name, path, storage_path, display_path, type, uploaded_by, property_id, job_id, folder_id, size
    ) VALUES (
      v_wo_name,
      '/' || v_sanitized_property || '/Work Orders/' || v_wo_name,
      '/' || v_sanitized_property || '/Work Orders/' || v_wo_name,
      v_display_base || '/Work Orders/' || v_wo_name,
      'folder/directory',
      v_user_id,
      p_property_id,
      p_job_id,
      v_work_orders_folder_id,
      0
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      property_id = EXCLUDED.property_id,
      job_id = EXCLUDED.job_id,
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

  -- Before Images
  -- Before Images (reuse existing if it already exists)
  SELECT id INTO v_before_images_folder_id
  FROM files
  WHERE folder_id = v_wo_folder_id
    AND name = 'Before Images'
    AND type = 'folder/directory'
  ORDER BY created_at
  LIMIT 1;

  IF v_before_images_folder_id IS NULL THEN
    INSERT INTO files (
      name, path, storage_path, display_path, type, uploaded_by, property_id, job_id, folder_id, size
    ) VALUES (
      'Before Images',
      '/' || v_sanitized_property || '/Work Orders/' || v_wo_name || '/Before Images',
      '/' || v_sanitized_property || '/Work Orders/' || v_wo_name || '/Before Images',
      v_display_base || '/Work Orders/' || v_wo_name || '/Before Images',
      'folder/directory',
      v_user_id,
      p_property_id,
      p_job_id,
      v_wo_folder_id,
      0
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      property_id = EXCLUDED.property_id,
      job_id = EXCLUDED.job_id,
      folder_id = EXCLUDED.folder_id,
      display_path = COALESCE(files.display_path, EXCLUDED.display_path),
      storage_path = COALESCE(files.storage_path, EXCLUDED.storage_path)
    RETURNING id INTO v_before_images_folder_id;
  ELSE
    UPDATE files
    SET
      display_path = COALESCE(display_path, v_display_base || '/Work Orders/' || v_wo_name || '/Before Images'),
      storage_path = COALESCE(storage_path, path)
    WHERE id = v_before_images_folder_id;
  END IF;

  -- Sprinkler Images
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
      name, path, storage_path, display_path, type, uploaded_by, property_id, job_id, folder_id, size
    ) VALUES (
      'Sprinkler Images',
      '/' || v_sanitized_property || '/Work Orders/' || v_wo_name || '/Sprinkler Images',
      '/' || v_sanitized_property || '/Work Orders/' || v_wo_name || '/Sprinkler Images',
      v_display_base || '/Work Orders/' || v_wo_name || '/Sprinkler Images',
      'folder/directory',
      v_user_id,
      p_property_id,
      p_job_id,
      v_wo_folder_id,
      0
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      property_id = EXCLUDED.property_id,
      job_id = EXCLUDED.job_id,
      folder_id = EXCLUDED.folder_id,
      display_path = COALESCE(files.display_path, EXCLUDED.display_path),
      storage_path = COALESCE(files.storage_path, EXCLUDED.storage_path)
    RETURNING id INTO v_sprinkler_images_folder_id;
  ELSE
    UPDATE files
    SET
      display_path = COALESCE(display_path, v_display_base || '/Work Orders/' || v_wo_name || '/Sprinkler Images'),
      storage_path = COALESCE(storage_path, path)
    WHERE id = v_sprinkler_images_folder_id;
  END IF;

  -- Other Files
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
      name, path, storage_path, display_path, type, uploaded_by, property_id, job_id, folder_id, size
    ) VALUES (
      'Other Files',
      '/' || v_sanitized_property || '/Work Orders/' || v_wo_name || '/Other Files',
      '/' || v_sanitized_property || '/Work Orders/' || v_wo_name || '/Other Files',
      v_display_base || '/Work Orders/' || v_wo_name || '/Other Files',
      'folder/directory',
      v_user_id,
      p_property_id,
      p_job_id,
      v_wo_folder_id,
      0
    )
    ON CONFLICT (path) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      uploaded_by = EXCLUDED.uploaded_by,
      property_id = EXCLUDED.property_id,
      job_id = EXCLUDED.job_id,
      folder_id = EXCLUDED.folder_id,
      display_path = COALESCE(files.display_path, EXCLUDED.display_path),
      storage_path = COALESCE(files.storage_path, EXCLUDED.storage_path)
    RETURNING id INTO v_other_files_folder_id;
  ELSE
    UPDATE files
    SET
      display_path = COALESCE(display_path, v_display_base || '/Work Orders/' || v_wo_name || '/Other Files'),
      storage_path = COALESCE(storage_path, path)
    WHERE id = v_other_files_folder_id;
  END IF;

  RETURN QUERY SELECT v_wo_folder_id, v_before_images_folder_id, v_sprinkler_images_folder_id, v_other_files_folder_id;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- Upload helper: resolve the correct folder without creating apostrophe variants
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_upload_folder(
  p_property_id UUID,
  p_job_id UUID DEFAULT NULL,
  p_folder_type TEXT DEFAULT 'other'
)
RETURNS UUID AS $$
DECLARE
  v_property_name TEXT;
  v_sanitized_property TEXT;
  v_folder_id UUID;
  v_work_order_num TEXT;
  v_wo_name TEXT;
  v_wo_folder_id UUID;
  v_before_folder_id UUID;
  v_sprinkler_folder_id UUID;
  v_other_folder_id UUID;
BEGIN
  SELECT property_name INTO v_property_name
  FROM properties
  WHERE id = p_property_id;

  IF v_property_name IS NULL THEN
    RAISE EXCEPTION 'Property not found: %', p_property_id;
  END IF;

  v_sanitized_property := normalize_property_storage_name(v_property_name);

  -- Property-level uploads (no job_id)
  IF p_job_id IS NULL THEN
    SELECT id
    INTO v_folder_id
    FROM files
    WHERE property_id = p_property_id
      AND name = 'Property Files'
      AND type = 'folder/directory'
    ORDER BY created_at
    LIMIT 1;

    IF v_folder_id IS NULL THEN
      SELECT id
      INTO v_folder_id
      FROM files
      WHERE path IN (
        '/' || v_property_name || '/Property Files',
        '/' || v_sanitized_property || '/Property Files',
        '/' || v_sanitized_property || '/Property_Files',
        v_sanitized_property || '/Property Files',
        v_sanitized_property || '/Property_Files',
        v_property_name || '/Property Files'
      )
        AND type = 'folder/directory'
      LIMIT 1;
    END IF;

    IF v_folder_id IS NULL THEN
      SELECT property_files_folder_id
      INTO v_folder_id
      FROM create_property_folder_structure(p_property_id, v_property_name);
    END IF;

    IF v_folder_id IS NULL THEN
      RAISE EXCEPTION 'Property Files folder could not be resolved for property: %', v_property_name;
    END IF;

    RETURN v_folder_id;
  END IF;

  -- Job-specific uploads
  SELECT work_order_num INTO v_work_order_num
  FROM jobs
  WHERE id = p_job_id;

  IF v_work_order_num IS NULL THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;

  v_wo_name := 'WO-' || LPAD(v_work_order_num::TEXT, 6, '0');

  -- Ensure work order folders exist and reuse the created IDs
  SELECT
    wo_folder_id,
    before_images_folder_id,
    sprinkler_images_folder_id,
    other_files_folder_id
  INTO
    v_wo_folder_id,
    v_before_folder_id,
    v_sprinkler_folder_id,
    v_other_folder_id
  FROM create_work_order_folder_structure(
    p_property_id,
    v_property_name,
    v_work_order_num::TEXT,
    p_job_id
  );

  IF p_folder_type = 'before' THEN
    v_folder_id := v_before_folder_id;
  ELSIF p_folder_type = 'sprinkler' THEN
    v_folder_id := v_sprinkler_folder_id;
  ELSE
    v_folder_id := v_other_folder_id;
  END IF;

  IF v_folder_id IS NULL THEN
    RAISE EXCEPTION 'Upload folder could not be resolved for job % (WO %)', p_job_id, v_wo_name;
  END IF;

  RETURN v_folder_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_upload_folder(UUID, UUID, TEXT) IS 'Returns the appropriate upload folder while normalizing apostrophes to avoid duplicate property/work order folders.';
