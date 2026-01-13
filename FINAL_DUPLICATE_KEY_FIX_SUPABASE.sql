-- 1. Safe folder creation helper
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
    v_user_id UUID;
BEGIN
    -- Extract folder name from path
    v_folder_name := regexp_replace(p_path, '^.*/', '');
    
    -- Get current user or system user
    SELECT COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)) INTO v_user_id;
    
    -- 1. Try to find existing folder by path
    SELECT id INTO v_folder_id
    FROM files
    WHERE path = p_path
    AND type IN ('folder/directory', 'folder/job', 'folder/property') -- Check all folder types
    LIMIT 1;
    
    -- 2. If not found, create it with conflict handling
    IF v_folder_id IS NULL THEN
        BEGIN
            INSERT INTO files (
                name, path, type, folder_id, property_id, job_id, uploaded_by, size
            )
            VALUES (
                v_folder_name, p_path, 'folder/directory', p_parent_folder_id,
                p_property_id, p_job_id, v_user_id, 0
            )
            ON CONFLICT (path) DO UPDATE
            SET name = EXCLUDED.name -- Dummy update to return ID
            RETURNING id INTO v_folder_id;
        EXCEPTION WHEN unique_violation THEN
            -- Race condition caught: folder was created by another process
            SELECT id INTO v_folder_id
            FROM files
            WHERE path = p_path AND type IN ('folder/directory', 'folder/job', 'folder/property')
            LIMIT 1;
        END;
    END IF;
    
    RETURN v_folder_id;
END;
$$;

-- 2. Update get_upload_folder to use the safe helper
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
    v_folder_name TEXT;
BEGIN
    -- Get property name
    SELECT property_name INTO v_property_name
    FROM properties WHERE id = p_property_id;
    
    IF v_property_name IS NULL THEN
        RAISE EXCEPTION 'Property not found: %', p_property_id;
    END IF;
    
    -- Ensure /Properties root exists
    v_properties_root_id := ensure_folder_exists('/Properties', NULL, NULL, NULL);
    
    -- Ensure property folder exists: /Properties/{Name}
    v_property_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name, 
        v_properties_root_id, 
        p_property_id, 
        NULL
    );
    
    -- Handle Property Files (Unit Maps, etc.)
    IF p_folder_type = 'property_files' THEN
        RETURN ensure_folder_exists(
            '/Properties/' || v_property_name || '/Property Files',
            v_property_folder_id, p_property_id, NULL
        );
    END IF;
    
    -- Handle Work Order Files
    IF p_job_id IS NOT NULL THEN
        SELECT work_order_num INTO v_work_order_num FROM jobs WHERE id = p_job_id;
        
        -- Ensure Work Orders root exists: /Properties/{Name}/Work Orders
        v_work_orders_folder_id := ensure_folder_exists(
            '/Properties/' || v_property_name || '/Work Orders',
            v_property_folder_id, p_property_id, NULL
        );
        
        -- Ensure specific WO folder exists: /Properties/{Name}/Work Orders/WO-{Num}
        v_wo_folder_id := ensure_folder_exists(
            '/Properties/' || v_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0'),
            v_work_orders_folder_id, p_property_id, p_job_id
        );
        
        -- Determine subfolder name
        v_folder_name := CASE p_folder_type
            WHEN 'before' THEN 'Before Images'
            WHEN 'after' THEN 'After Images'
            WHEN 'sprinkler' THEN 'Sprinkler Images'
            WHEN 'job_files' THEN 'Job Files'
            ELSE 'Other Files'
        END;
        
        -- Return final target folder ID
        RETURN ensure_folder_exists(
            '/Properties/' || v_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0') || '/' || v_folder_name,
            v_wo_folder_id, p_property_id, p_job_id
        );
    END IF;
    
    RAISE EXCEPTION 'Invalid parameters for get_upload_folder';
END;
$$;

-- 3. Grant permissions
GRANT EXECUTE ON FUNCTION ensure_folder_exists TO authenticated;
GRANT EXECUTE ON FUNCTION get_upload_folder TO authenticated;
