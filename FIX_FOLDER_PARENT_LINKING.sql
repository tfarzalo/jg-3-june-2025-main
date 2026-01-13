-- ==============================================================================
-- DEBUG & FIX: FORCE PARENT LINKING
-- ==============================================================================

BEGIN;

-- 1. Redefine ensure_folder_exists to FORCE parent update on conflict
-- This ensures that even if a folder exists, we enforce its correct location.
CREATE OR REPLACE FUNCTION ensure_folder_exists(
    p_path TEXT,
    p_parent_folder_id UUID DEFAULT NULL,
    p_property_id UUID DEFAULT NULL,
    p_job_id UUID DEFAULT NULL,
    p_folder_type TEXT DEFAULT 'folder/directory'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_folder_id UUID;
    v_folder_name TEXT;
    v_user_id UUID;
BEGIN
    v_folder_name := regexp_replace(p_path, '^.*/', '');
    
    SELECT COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)) INTO v_user_id;
    
    -- Try to create, or update parent if exists
    INSERT INTO files (
        name, path, type, folder_id, property_id, job_id, uploaded_by, size
    )
    VALUES (
        v_folder_name, p_path, p_folder_type, p_parent_folder_id,
        p_property_id, p_job_id, v_user_id, 0
    )
    ON CONFLICT (path) DO UPDATE
    SET 
        folder_id = EXCLUDED.folder_id, -- <--- CRITICAL FIX: Enforce Parent!
        type = EXCLUDED.type,           -- <--- CRITICAL FIX: Enforce Type!
        property_id = COALESCE(EXCLUDED.property_id, files.property_id),
        job_id = COALESCE(EXCLUDED.job_id, files.job_id)
    RETURNING id INTO v_folder_id;
    
    RETURN v_folder_id;
END;
$$;

-- 2. Force Update of Trigger just in case
CREATE OR REPLACE FUNCTION create_job_folder()
RETURNS TRIGGER AS $$
DECLARE
    v_property_name TEXT;
    v_properties_root_id UUID;
    v_property_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_job_folder_id UUID;
    v_work_order_num TEXT;
BEGIN
    SELECT property_name INTO v_property_name FROM properties WHERE id = NEW.property_id;
    IF v_property_name IS NULL THEN RETURN NEW; END IF;

    -- 1. Ensure Root /Properties (Parent = NULL)
    v_properties_root_id := ensure_folder_exists('/Properties', NULL, NULL, NULL, 'folder/directory');

    -- 2. Ensure Property Folder (Parent = Root)
    v_property_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name,
        v_properties_root_id,
        NEW.property_id,
        NULL,
        'folder/property'
    );

    -- 3. Ensure Work Orders Folder (Parent = Property Folder)
    v_work_orders_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name || '/Work Orders',
        v_property_folder_id,
        NEW.property_id,
        NULL,
        'folder/directory'
    );

    -- 4. Create Job Folder (Parent = Work Orders Folder)
    v_work_order_num := 'WO-' || LPAD(NEW.work_order_num::text, 6, '0');
    
    v_job_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name || '/Work Orders/' || v_work_order_num,
        v_work_orders_folder_id,
        NEW.property_id,
        NEW.id,
        'folder/job'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
