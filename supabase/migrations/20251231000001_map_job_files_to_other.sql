-- Map 'job_files' to 'other' in get_upload_folder for legacy callers
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
  v_effective_type TEXT;
BEGIN
  v_effective_type := CASE LOWER(p_folder_type)
    WHEN 'job_files' THEN 'other'
    ELSE LOWER(p_folder_type)
  END;

  SELECT property_name INTO v_property_name
  FROM properties
  WHERE id = p_property_id;

  IF v_property_name IS NULL THEN
    RAISE EXCEPTION 'Property not found: %', p_property_id;
  END IF;

  v_sanitized_property := normalize_property_storage_name(v_property_name);

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
      SELECT property_files_folder_id
      INTO v_folder_id
      FROM create_property_folder_structure(p_property_id, v_property_name);
    END IF;

    RETURN v_folder_id;
  END IF;

  SELECT work_order_num INTO v_work_order_num
  FROM jobs
  WHERE id = p_job_id;

  v_wo_name := 'WO-' || LPAD(v_work_order_num::TEXT, 6, '0');

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

  IF v_effective_type = 'before' THEN
    v_folder_id := v_before_folder_id;
  ELSIF v_effective_type = 'sprinkler' THEN
    v_folder_id := v_sprinkler_folder_id;
  ELSE
    v_folder_id := v_other_folder_id;
  END IF;

  RETURN v_folder_id;
END;
$$ LANGUAGE plpgsql;
