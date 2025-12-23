-- Fix for duplicate key error AND structure enforcement (Properties / JG Docs)
-- Covers: ensure_folder_exists, get_upload_folder, create_work_order_folder_structure, create_property_folder_structure

-- ==========================================
-- 0. DROP EXISTING FUNCTIONS (To avoid signature conflicts)
-- ==========================================
DROP FUNCTION IF EXISTS ensure_folder_exists(TEXT, UUID, UUID, UUID);
DROP FUNCTION IF EXISTS get_upload_folder(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS create_property_folder_structure(UUID, TEXT);
DROP FUNCTION IF EXISTS create_work_order_folder_structure(UUID, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS get_or_create_root_folder(TEXT);

-- ==========================================
-- 1. Safe Folder Creation Function (Fixed)
-- ==========================================
CREATE OR REPLACE FUNCTION ensure_folder_exists(
    p_path TEXT,
    p_parent_folder_id UUID DEFAULT NULL,
    p_property_id UUID DEFAULT NULL,
    p_job_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_folder_id UUID;
    v_folder_name TEXT;
BEGIN
    -- Extract folder name from path
    v_folder_name := regexp_replace(p_path, '^.*/', '');
    
    -- 1. Try to find existing folder by path first
    SELECT id INTO v_folder_id
    FROM files
    WHERE path = p_path
    AND type = 'folder/directory'
    LIMIT 1;
    
    -- 2. If not found by path, try by name and parent
    -- This handles the case where metadata is out of sync or race conditions
    IF v_folder_id IS NULL THEN
        SELECT id INTO v_folder_id
        FROM files
        WHERE name = v_folder_name
        AND type = 'folder/directory'
        AND (
            (p_parent_folder_id IS NULL AND folder_id IS NULL) OR
            (folder_id = p_parent_folder_id)
        )
        LIMIT 1;
    END IF;
    
    -- 3. If still not found, create it with exception handling
    IF v_folder_id IS NULL THEN
        BEGIN
            INSERT INTO files (
                name,
                path,
                type,
                folder_id,
                property_id,
                job_id,
                uploaded_by
            )
            VALUES (
                v_folder_name,
                p_path,
                'folder/directory',
                p_parent_folder_id,
                p_property_id,
                p_job_id,
                auth.uid()
            )
            RETURNING id INTO v_folder_id;
        EXCEPTION 
            WHEN unique_violation THEN
                -- Handle collision on either path or (folder_id, name)
                RAISE NOTICE 'Caught unique_violation for folder %, retrying lookup', p_path;
                
                -- Retry lookup by path
                SELECT id INTO v_folder_id
                FROM files
                WHERE path = p_path
                AND type = 'folder/directory'
                LIMIT 1;
                
                -- Retry lookup by name/parent
                IF v_folder_id IS NULL THEN
                    SELECT id INTO v_folder_id
                    FROM files
                    WHERE name = v_folder_name
                    AND type = 'folder/directory'
                    AND (
                        (p_parent_folder_id IS NULL AND folder_id IS NULL) OR
                        (folder_id = p_parent_folder_id)
                    )
                    LIMIT 1;
                END IF;
                
                IF v_folder_id IS NULL THEN
                    RAISE WARNING 'Could not create or find folder after unique violation: %', p_path;
                END IF;
        END;
    END IF;
    
    RETURN v_folder_id;
END;
$$;

-- ==========================================
-- 2. Helper to Get/Create Root Folders
-- ==========================================
CREATE OR REPLACE FUNCTION get_or_create_root_folder(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_folder_id UUID;
BEGIN
    SELECT id INTO v_folder_id
    FROM files
    WHERE name = p_name
    AND folder_id IS NULL
    AND type = 'folder/directory'
    LIMIT 1;
    
    IF v_folder_id IS NULL THEN
        INSERT INTO files (name, path, type, uploaded_by, folder_id, size)
        VALUES (
            p_name, 
            '/' || p_name, 
            'folder/directory', 
            auth.uid(), 
            NULL, 
            0
        )
        ON CONFLICT (path) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_folder_id;
    END IF;
    
    RETURN v_folder_id;
END;
$$;

-- ==========================================
-- 3. Updated create_property_folder_structure (Strict Structure)
-- ==========================================
CREATE OR REPLACE FUNCTION create_property_folder_structure(
    p_property_id UUID,
    p_property_name TEXT
)
RETURNS TABLE (
    property_folder_id UUID,
    work_orders_folder_id UUID,
    property_files_folder_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sanitized_property_name TEXT;
    v_properties_root_id UUID;
    v_property_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_property_files_folder_id UUID;
BEGIN
    -- Sanitize property name
    v_sanitized_property_name := regexp_replace(p_property_name, '[^a-zA-Z0-9\s-]', '', 'g');
    v_sanitized_property_name := regexp_replace(v_sanitized_property_name, '\s+', ' ', 'g');
    v_sanitized_property_name := trim(v_sanitized_property_name);
    
    -- 1. Ensure Properties Root
    v_properties_root_id := get_or_create_root_folder('Properties');
    
    -- 2. Ensure Property Folder (Parented by Properties)
    v_property_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name,
        v_properties_root_id,
        p_property_id,
        NULL
    );
    
    -- Self-heal parent if needed
    UPDATE files 
    SET folder_id = v_properties_root_id 
    WHERE id = v_property_folder_id 
    AND (folder_id IS NULL OR folder_id != v_properties_root_id);

    -- 3. Ensure Work Orders Folder
    v_work_orders_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders',
        v_property_folder_id,
        p_property_id,
        NULL
    );
    
    -- 4. Ensure Property Files Folder
    v_property_files_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Property Files',
        v_property_folder_id,
        p_property_id,
        NULL
    );
    
    RETURN QUERY SELECT v_property_folder_id, v_work_orders_folder_id, v_property_files_folder_id;
END;
$$;

-- ==========================================
-- 4. Updated get_upload_folder (Enforcing Structure)
-- ==========================================
CREATE OR REPLACE FUNCTION get_upload_folder(
    p_property_id UUID,
    p_job_id UUID,
    p_folder_type TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_property_name TEXT;
    v_work_order_num INTEGER;
    v_properties_root_id UUID;
    v_property_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_wo_folder_id UUID;
    v_target_folder_id UUID;
    v_sanitized_property_name TEXT;
    v_folder_name TEXT;
BEGIN
    -- Get property name
    SELECT property_name INTO v_property_name
    FROM properties
    WHERE id = p_property_id;
    
    IF v_property_name IS NULL THEN
        RAISE EXCEPTION 'Property not found: %', p_property_id;
    END IF;
    
    -- Sanitize property name for folder path
    v_sanitized_property_name := regexp_replace(v_property_name, '[^a-zA-Z0-9\s-]', '', 'g');
    v_sanitized_property_name := regexp_replace(v_sanitized_property_name, '\s+', ' ', 'g');
    v_sanitized_property_name := trim(v_sanitized_property_name);
    
    -- ENSURE STRUCTURE: Get "Properties" root folder
    v_properties_root_id := get_or_create_root_folder('Properties');
    
    -- Ensure "JG Docs and Info" exists (enforce structure requirement)
    PERFORM get_or_create_root_folder('JG Docs and Info');
    
    -- STEP 1: Ensure property folder exists (Parented by Properties Root)
    v_property_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name,
        v_properties_root_id, -- Force parent to be Properties root
        p_property_id,
        NULL
    );
    
    -- Self-heal: If property folder exists but is not under Properties root, move it
    UPDATE files 
    SET folder_id = v_properties_root_id 
    WHERE id = v_property_folder_id 
    AND (folder_id IS NULL OR folder_id != v_properties_root_id);
    
    -- For property files (unit maps, etc.)
    IF p_folder_type = 'property_files' THEN
        v_target_folder_id := ensure_folder_exists(
            '/' || v_sanitized_property_name || '/Property Files',
            v_property_folder_id,
            p_property_id,
            NULL
        );
        RETURN v_target_folder_id;
    END IF;
    
    -- For work order files
    IF p_job_id IS NOT NULL THEN
        -- Get work order number
        SELECT work_order_num INTO v_work_order_num
        FROM jobs
        WHERE id = p_job_id;
        
        IF v_work_order_num IS NULL THEN
            RAISE EXCEPTION 'Job not found or missing work_order_num: %', p_job_id;
        END IF;
        
        -- STEP 2: Ensure Work Orders folder exists
        v_work_orders_folder_id := ensure_folder_exists(
            '/' || v_sanitized_property_name || '/Work Orders',
            v_property_folder_id,
            p_property_id,
            NULL
        );
        
        -- STEP 3: Ensure specific work order folder exists
        v_wo_folder_id := ensure_folder_exists(
            '/' || v_sanitized_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0'),
            v_work_orders_folder_id,
            p_property_id,
            p_job_id
        );
        
        -- STEP 4: Determine target folder based on type
        CASE p_folder_type
            WHEN 'before' THEN
                v_folder_name := 'Before Images';
            WHEN 'sprinkler' THEN
                v_folder_name := 'Sprinkler Images';
            WHEN 'other' THEN
                v_folder_name := 'Other Files';
            ELSE
                v_folder_name := 'Other Files';
        END CASE;
        
        v_target_folder_id := ensure_folder_exists(
            '/' || v_sanitized_property_name || '/Work Orders/WO-' || 
            LPAD(v_work_order_num::text, 6, '0') || '/' || v_folder_name,
            v_wo_folder_id,
            p_property_id,
            p_job_id
        );
        
        RETURN v_target_folder_id;
    END IF;
    
    RAISE EXCEPTION 'Invalid folder type or missing job_id: %', p_folder_type;
END;
$$;

-- ==========================================
-- 5. Updated create_work_order_folder_structure (Enforcing Structure)
-- ==========================================
CREATE OR REPLACE FUNCTION create_work_order_folder_structure(
    p_property_id UUID,
    p_property_name TEXT,
    p_work_order_num TEXT,
    p_job_id UUID
)
RETURNS TABLE (
    before_images_folder_id UUID,
    sprinkler_images_folder_id UUID,
    other_files_folder_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sanitized_property_name TEXT;
    v_properties_root_id UUID;
    v_property_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_wo_folder_id UUID;
    v_before_id UUID;
    v_sprinkler_id UUID;
    v_other_id UUID;
BEGIN
    -- Sanitize property name
    v_sanitized_property_name := regexp_replace(p_property_name, '[^a-zA-Z0-9\s-]', '', 'g');
    v_sanitized_property_name := regexp_replace(v_sanitized_property_name, '\s+', ' ', 'g');
    v_sanitized_property_name := trim(v_sanitized_property_name);
    
    -- ENSURE STRUCTURE: Get "Properties" root folder
    v_properties_root_id := get_or_create_root_folder('Properties');
    
    -- Create folder hierarchy using safe function AND enforcing parent
    v_property_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name,
        v_properties_root_id,
        p_property_id,
        NULL
    );
    
    -- Self-heal
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
        v_wo_folder_id,
        p_property_id,
        p_job_id
    );
    
    v_sprinkler_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders/WO-' || p_work_order_num || '/Sprinkler Images',
        v_wo_folder_id,
        p_property_id,
        p_job_id
    );
    
    v_other_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders/WO-' || p_work_order_num || '/Other Files',
        v_wo_folder_id,
        p_property_id,
        p_job_id
    );
    
    RETURN QUERY SELECT v_before_id, v_sprinkler_id, v_other_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION ensure_folder_exists(TEXT, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_root_folder(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_property_folder_structure(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_upload_folder(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_work_order_folder_structure(UUID, TEXT, TEXT, UUID) TO authenticated;
