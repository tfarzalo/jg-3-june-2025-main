-- Fix get_upload_folder to support 'after' / 'after_images' folder type,
-- and to accept all normalised category names that the frontend passes
-- (before_images, after_images, sprinkler_images, other_files, job_files).
--
-- Root cause: the CASE statement only matched 'before', 'sprinkler', 'other'.
-- When ImageUpload passes p_folder_type = 'after_images' (the normalised value
-- returned by FOLDER_KEY_TO_CATEGORY['after']), it fell through to ELSE which
-- mapped it to 'Other Files' — a folder that may not exist yet, producing a
-- foreign-key violation ("Invalid reference: Check property or parent folder exists").
--
-- We DROP first because Postgres refuses CREATE OR REPLACE when the parameter
-- signature (defaults) differs from the existing function.

DROP FUNCTION IF EXISTS get_upload_folder(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS create_work_order_folder_structure(UUID, TEXT, TEXT, UUID);

-- ============================================================
-- get_upload_folder
-- ============================================================
CREATE FUNCTION get_upload_folder(
    p_property_id UUID,
    p_job_id      UUID,
    p_folder_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_property_name          TEXT;
    v_work_order_num         INTEGER;
    v_properties_root_id     UUID;
    v_property_folder_id     UUID;
    v_work_orders_folder_id  UUID;
    v_wo_folder_id           UUID;
    v_target_folder_id       UUID;
    v_sanitized_property_name TEXT;
    v_folder_name            TEXT;
BEGIN
    -- ----------------------------------------------------------------
    -- Resolve property name
    -- ----------------------------------------------------------------
    SELECT property_name INTO v_property_name
    FROM properties
    WHERE id = p_property_id;

    IF v_property_name IS NULL THEN
        RAISE EXCEPTION 'Property not found: %', p_property_id;
    END IF;

    -- Sanitize property name for folder path
    v_sanitized_property_name := regexp_replace(v_property_name, '[^a-zA-Z0-9\s\-]', '', 'g');
    v_sanitized_property_name := regexp_replace(v_sanitized_property_name, '\s+', ' ', 'g');
    v_sanitized_property_name := trim(v_sanitized_property_name);

    -- ----------------------------------------------------------------
    -- Ensure root structure exists
    -- ----------------------------------------------------------------
    v_properties_root_id := get_or_create_root_folder('Properties');
    PERFORM get_or_create_root_folder('JG Docs and Info');

    -- ----------------------------------------------------------------
    -- Ensure property folder (child of Properties root)
    -- ----------------------------------------------------------------
    v_property_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name,
        v_properties_root_id,
        p_property_id,
        NULL
    );

    -- Self-heal: keep property folder under Properties root
    UPDATE files
    SET folder_id = v_properties_root_id
    WHERE id = v_property_folder_id
      AND (folder_id IS NULL OR folder_id != v_properties_root_id);

    -- ----------------------------------------------------------------
    -- Property-level files (unit maps, etc.) — no job required
    -- ----------------------------------------------------------------
    IF p_folder_type IN ('property_files', 'property-files') THEN
        v_target_folder_id := ensure_folder_exists(
            '/' || v_sanitized_property_name || '/Property Files',
            v_property_folder_id,
            p_property_id,
            NULL
        );
        RETURN v_target_folder_id;
    END IF;

    -- ----------------------------------------------------------------
    -- Work-order-scoped folders — job_id required
    -- ----------------------------------------------------------------
    IF p_job_id IS NULL THEN
        RAISE EXCEPTION 'job_id is required for folder type: %', p_folder_type;
    END IF;

    SELECT work_order_num INTO v_work_order_num
    FROM jobs
    WHERE id = p_job_id;

    IF v_work_order_num IS NULL THEN
        RAISE EXCEPTION 'Job not found or missing work_order_num: %', p_job_id;
    END IF;

    -- Ensure Work Orders folder
    v_work_orders_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders',
        v_property_folder_id,
        p_property_id,
        NULL
    );

    -- Ensure specific WO folder
    v_wo_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::TEXT, 6, '0'),
        v_work_orders_folder_id,
        p_property_id,
        p_job_id
    );

    -- ----------------------------------------------------------------
    -- Map p_folder_type → human-readable folder name
    -- Accepts both the short key ('before') and the normalised category
    -- name ('before_images') so that any caller works correctly.
    -- ----------------------------------------------------------------
    CASE p_folder_type
        WHEN 'before'           THEN v_folder_name := 'Before Images';
        WHEN 'before_images'    THEN v_folder_name := 'Before Images';
        WHEN 'after'            THEN v_folder_name := 'After Images';
        WHEN 'after_images'     THEN v_folder_name := 'After Images';
        WHEN 'sprinkler'        THEN v_folder_name := 'Sprinkler Images';
        WHEN 'sprinkler_images' THEN v_folder_name := 'Sprinkler Images';
        WHEN 'other'            THEN v_folder_name := 'Other Files';
        WHEN 'other_files'      THEN v_folder_name := 'Other Files';
        WHEN 'job_files'        THEN v_folder_name := 'Job Files';
        WHEN 'job-files'        THEN v_folder_name := 'Job Files';
        ELSE                         v_folder_name := 'Other Files';
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

-- Re-grant execute to authenticated (subcontractors are authenticated users)
GRANT EXECUTE ON FUNCTION get_upload_folder(UUID, UUID, TEXT) TO authenticated;

-- Also update create_work_order_folder_structure to pre-create the After Images
-- folder alongside Before/Sprinkler/Other so it always exists when a WO is created.
CREATE OR REPLACE FUNCTION create_work_order_folder_structure(
    p_property_id UUID,
    p_property_name TEXT,
    p_work_order_num TEXT,
    p_job_id UUID
)
RETURNS TABLE (
    before_images_folder_id    UUID,
    after_images_folder_id     UUID,
    sprinkler_images_folder_id UUID,
    other_files_folder_id      UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sanitized_property_name TEXT;
    v_properties_root_id      UUID;
    v_property_folder_id      UUID;
    v_work_orders_folder_id   UUID;
    v_wo_folder_id            UUID;
    v_before_id               UUID;
    v_after_id                UUID;
    v_sprinkler_id            UUID;
    v_other_id                UUID;
BEGIN
    v_sanitized_property_name := regexp_replace(p_property_name, '[^a-zA-Z0-9\s\-]', '', 'g');
    v_sanitized_property_name := regexp_replace(v_sanitized_property_name, '\s+', ' ', 'g');
    v_sanitized_property_name := trim(v_sanitized_property_name);

    v_properties_root_id := get_or_create_root_folder('Properties');

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

    v_work_orders_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders',
        v_property_folder_id,
        p_property_id,
        NULL
    );

    v_wo_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders/WO-' || p_work_order_num,
        v_work_orders_folder_id,
        p_property_id,
        p_job_id
    );

    v_before_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders/WO-' || p_work_order_num || '/Before Images',
        v_wo_folder_id, p_property_id, p_job_id
    );

    v_after_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders/WO-' || p_work_order_num || '/After Images',
        v_wo_folder_id, p_property_id, p_job_id
    );

    v_sprinkler_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders/WO-' || p_work_order_num || '/Sprinkler Images',
        v_wo_folder_id, p_property_id, p_job_id
    );

    v_other_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders/WO-' || p_work_order_num || '/Other Files',
        v_wo_folder_id, p_property_id, p_job_id
    );

    RETURN QUERY SELECT v_before_id, v_after_id, v_sprinkler_id, v_other_id;
END;
$$;

GRANT EXECUTE ON FUNCTION create_work_order_folder_structure(UUID, TEXT, TEXT, UUID) TO authenticated;
