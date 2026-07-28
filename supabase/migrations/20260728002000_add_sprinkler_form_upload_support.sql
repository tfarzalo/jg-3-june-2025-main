-- Add sprinkler form photo support to work orders and file uploads.

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS sprinkler_form_left_in_unit boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.work_orders.sprinkler_form_left_in_unit IS
  'Whether the subcontractor/admin indicated a sprinkler form was left in the unit.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'files_category_check') THEN
    ALTER TABLE public.files DROP CONSTRAINT files_category_check;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_category') THEN
    ALTER TABLE public.files DROP CONSTRAINT valid_category;
  END IF;
END $$;

ALTER TABLE public.files
  ADD CONSTRAINT files_category_check
  CHECK (
    category IS NULL OR category IN (
      'property_files',
      'job_files',
      'before',
      'sprinkler',
      'sprinkler_form',
      'other',
      'before_images',
      'after_images',
      'sprinkler_images',
      'sprinkler_with_cover_images',
      'sprinkler_without_cover_images',
      'sprinkler_form_images',
      'other_files'
    )
  );

CREATE INDEX IF NOT EXISTS idx_files_sprinkler_form_uploads
  ON public.files(job_id, work_order_id, category)
  WHERE category IN ('sprinkler_form', 'sprinkler_form_images');

CREATE OR REPLACE FUNCTION get_upload_folder(
    p_property_id UUID,
    p_job_id      UUID,
    p_folder_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_property_name           TEXT;
    v_work_order_num          INTEGER;
    v_properties_root_id      UUID;
    v_property_folder_id      UUID;
    v_work_orders_folder_id   UUID;
    v_wo_folder_id            UUID;
    v_target_folder_id        UUID;
    v_sanitized_property_name TEXT;
    v_folder_name             TEXT;
BEGIN
    SELECT property_name INTO v_property_name
    FROM properties
    WHERE id = p_property_id;

    IF v_property_name IS NULL THEN
        RAISE EXCEPTION 'Property not found: %', p_property_id;
    END IF;

    v_sanitized_property_name := regexp_replace(v_property_name, '[^a-zA-Z0-9\s\-]', '', 'g');
    v_sanitized_property_name := regexp_replace(v_sanitized_property_name, '\s+', ' ', 'g');
    v_sanitized_property_name := trim(v_sanitized_property_name);

    v_properties_root_id := get_or_create_root_folder('Properties');
    PERFORM get_or_create_root_folder('JG Docs and Info');

    v_property_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name,
        v_properties_root_id,
        p_property_id,
        NULL
    );

    UPDATE files
    SET folder_id = v_properties_root_id
    WHERE id = v_property_folder_id
      AND (folder_id IS NULL OR folder_id != v_properties_root_id);

    IF p_folder_type IN ('property_files', 'property-files') THEN
        v_target_folder_id := ensure_folder_exists(
            '/' || v_sanitized_property_name || '/Property Files',
            v_property_folder_id,
            p_property_id,
            NULL
        );
        RETURN v_target_folder_id;
    END IF;

    IF p_job_id IS NULL THEN
        RAISE EXCEPTION 'job_id is required for folder type: %', p_folder_type;
    END IF;

    SELECT work_order_num INTO v_work_order_num
    FROM jobs
    WHERE id = p_job_id;

    IF v_work_order_num IS NULL THEN
        RAISE EXCEPTION 'Job not found or missing work_order_num: %', p_job_id;
    END IF;

    v_work_orders_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders',
        v_property_folder_id,
        p_property_id,
        NULL
    );

    v_wo_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::TEXT, 6, '0'),
        v_work_orders_folder_id,
        p_property_id,
        p_job_id
    );

    CASE p_folder_type
        WHEN 'before'                          THEN v_folder_name := 'Before Images';
        WHEN 'before_images'                   THEN v_folder_name := 'Before Images';
        WHEN 'after'                           THEN v_folder_name := 'After Images';
        WHEN 'after_images'                    THEN v_folder_name := 'After Images';
        WHEN 'sprinkler'                       THEN v_folder_name := 'Sprinkler Images with Cover';
        WHEN 'sprinkler_images'                THEN v_folder_name := 'Sprinkler Images with Cover';
        WHEN 'sprinkler_with_cover'            THEN v_folder_name := 'Sprinkler Images with Cover';
        WHEN 'sprinkler_with_cover_images'     THEN v_folder_name := 'Sprinkler Images with Cover';
        WHEN 'sprinkler_without_cover'         THEN v_folder_name := 'Sprinkler Images without Cover';
        WHEN 'sprinkler_without_cover_images'  THEN v_folder_name := 'Sprinkler Images without Cover';
        WHEN 'sprinkler_form'                  THEN v_folder_name := 'Sprinkler Form Images';
        WHEN 'sprinkler_form_images'           THEN v_folder_name := 'Sprinkler Form Images';
        WHEN 'other'                           THEN v_folder_name := 'Other Files';
        WHEN 'other_files'                     THEN v_folder_name := 'Other Files';
        WHEN 'job_files'                       THEN v_folder_name := 'Job Files';
        WHEN 'job-files'                       THEN v_folder_name := 'Job Files';
        ELSE                                        v_folder_name := 'Other Files';
    END CASE;

    v_target_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders/WO-' ||
            LPAD(v_work_order_num::TEXT, 6, '0') || '/' || v_folder_name,
        v_wo_folder_id,
        p_property_id,
        p_job_id
    );

    RETURN v_target_folder_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_upload_folder(UUID, UUID, TEXT) TO authenticated;
