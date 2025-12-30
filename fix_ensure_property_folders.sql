-- Fix ensure_property_folders_exist and create_property_folder_structure to use /Properties

-- 1. Redefine create_property_folder_structure
CREATE OR REPLACE FUNCTION create_property_folder_structure(
    p_property_id UUID,
    p_property_name TEXT
)
RETURNS TABLE(
    property_folder_id UUID,
    work_orders_folder_id UUID,
    property_files_folder_id UUID
) AS $$
DECLARE
    v_properties_root_id UUID;
    v_property_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_property_files_folder_id UUID;
    v_user_id UUID;
BEGIN
    -- Get system user
    SELECT id INTO v_user_id FROM auth.users ORDER BY created_at ASC LIMIT 1;

    -- 1. Ensure /Properties root exists
    INSERT INTO files (name, path, type, uploaded_by, size)
    VALUES ('Properties', '/Properties', 'folder/directory', v_user_id, 0)
    ON CONFLICT (path) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_properties_root_id;

    -- 2. Ensure /Properties/{Name} exists
    INSERT INTO files (name, path, folder_id, type, uploaded_by, property_id, size)
    VALUES (
        p_property_name,
        '/Properties/' || p_property_name,
        v_properties_root_id,
        'folder/property',
        v_user_id,
        p_property_id,
        0
    )
    ON CONFLICT (path) DO UPDATE SET 
        folder_id = v_properties_root_id,
        type = 'folder/property',
        property_id = EXCLUDED.property_id
    RETURNING id INTO v_property_folder_id;

    -- 3. Ensure Work Orders subfolder
    INSERT INTO files (name, path, folder_id, type, uploaded_by, property_id, size)
    VALUES (
        'Work Orders',
        '/Properties/' || p_property_name || '/Work Orders',
        v_property_folder_id,
        'folder/directory',
        v_user_id,
        p_property_id,
        0
    )
    ON CONFLICT (path) DO UPDATE SET folder_id = v_property_folder_id
    RETURNING id INTO v_work_orders_folder_id;

    -- 4. Ensure Property Files subfolder
    INSERT INTO files (name, path, folder_id, type, uploaded_by, property_id, size)
    VALUES (
        'Property Files',
        '/Properties/' || p_property_name || '/Property Files',
        v_property_folder_id,
        'folder/directory',
        v_user_id,
        p_property_id,
        0
    )
    ON CONFLICT (path) DO UPDATE SET folder_id = v_property_folder_id
    RETURNING id INTO v_property_files_folder_id;

    RETURN QUERY SELECT 
        v_property_folder_id,
        v_work_orders_folder_id,
        v_property_files_folder_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Redefine ensure_property_folders_exist to look in /Properties
CREATE OR REPLACE FUNCTION ensure_property_folders_exist(
    p_property_id UUID,
    p_property_name TEXT
)
RETURNS TABLE(
    property_folder_id UUID,
    work_orders_folder_id UUID,
    property_files_folder_id UUID,
    folders_existed BOOLEAN,
    folders_created BOOLEAN
) AS $$
DECLARE
    v_property_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_property_files_folder_id UUID;
    v_folders_existed BOOLEAN := FALSE;
    v_folders_created BOOLEAN := FALSE;
BEGIN
    -- Check if folders already exist in /Properties
    SELECT 
        pf.id, wof.id, pff.id
    INTO 
        v_property_folder_id, v_work_orders_folder_id, v_property_files_folder_id
    FROM files pf
    LEFT JOIN files wof ON wof.folder_id = pf.id 
        AND wof.name = 'Work Orders' 
        AND wof.type = 'folder/directory'
    LEFT JOIN files pff ON pff.folder_id = pf.id 
        AND pff.name = 'Property Files' 
        AND pff.type = 'folder/directory'
    WHERE pf.property_id = p_property_id
        AND pf.path = '/Properties/' || p_property_name -- Explicitly check path
        AND pf.type = 'folder/property'
    LIMIT 1;
    
    -- If all folders exist, return them
    IF v_property_folder_id IS NOT NULL 
       AND v_work_orders_folder_id IS NOT NULL 
       AND v_property_files_folder_id IS NOT NULL THEN
        v_folders_existed := TRUE;
    ELSE
        -- Folders don't exist or are incomplete, create them
        SELECT 
            cps.property_folder_id, cps.work_orders_folder_id, cps.property_files_folder_id
        INTO 
            v_property_folder_id, v_work_orders_folder_id, v_property_files_folder_id
        FROM create_property_folder_structure(p_property_id, p_property_name) AS cps;
        
        v_folders_created := TRUE;
    END IF;
    
    RETURN QUERY SELECT 
        v_property_folder_id,
        v_work_orders_folder_id,
        v_property_files_folder_id,
        v_folders_existed,
        v_folders_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
