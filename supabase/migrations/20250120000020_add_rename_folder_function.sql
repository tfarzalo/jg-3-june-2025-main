-- Function to rename a folder and update all related file/folder paths
-- This ensures consistency across the database and storage paths

CREATE OR REPLACE FUNCTION rename_folder(
    p_folder_id UUID,
    p_new_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_name TEXT;
    v_old_display_path TEXT;
    v_old_storage_path TEXT;
    v_new_display_path TEXT;
    v_new_storage_path TEXT;
    v_parent_folder_id UUID;
    v_property_id UUID;
    v_job_id UUID;
    v_user_id UUID;
    v_updated_files INTEGER := 0;
    v_updated_folders INTEGER := 0;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get the folder details
    SELECT name, display_path, storage_path, folder_id, property_id, job_id
    INTO v_old_name, v_old_display_path, v_old_storage_path, v_parent_folder_id, v_property_id, v_job_id
    FROM files
    WHERE id = p_folder_id AND type = 'folder/directory';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Folder not found';
    END IF;

    -- Sanitize the new name for storage (replace spaces with underscores)
    v_new_storage_path := v_old_storage_path;
    
    -- Replace the old folder name in the storage path with the sanitized new name
    IF v_parent_folder_id IS NULL THEN
        -- Root level folder
        v_new_storage_path := regexp_replace(v_old_storage_path, v_old_name || '$', sanitize_for_storage(p_new_name));
        v_new_display_path := regexp_replace(v_old_display_path, v_old_name || '$', p_new_name);
    ELSE
        -- Nested folder - need to replace within the path
        v_new_storage_path := regexp_replace(v_old_storage_path, '/' || v_old_name || '$', '/' || sanitize_for_storage(p_new_name));
        v_new_display_path := regexp_replace(v_old_display_path, '/' || v_old_name || '$', '/' || p_new_name);
    END IF;

    -- Log the operation for debugging
    RAISE NOTICE 'Renaming folder: % -> %', v_old_name, p_new_name;
    RAISE NOTICE 'Old storage path: %', v_old_storage_path;
    RAISE NOTICE 'New storage path: %', v_new_storage_path;
    RAISE NOTICE 'Old display path: %', v_old_display_path;
    RAISE NOTICE 'New display path: %', v_new_display_path;

    -- Update the folder itself
    UPDATE files
    SET 
        name = p_new_name,
        display_path = v_new_display_path,
        storage_path = v_new_storage_path,
        updated_at = NOW()
    WHERE id = p_folder_id;

    -- Update all child files (direct children)
    WITH updated AS (
        UPDATE files
        SET 
            path = REPLACE(path, v_old_storage_path, v_new_storage_path),
            storage_path = REPLACE(storage_path, v_old_storage_path, v_new_storage_path),
            display_path = REPLACE(display_path, v_old_display_path, v_new_display_path),
            updated_at = NOW()
        WHERE folder_id = p_folder_id AND type != 'folder/directory'
        RETURNING id
    )
    SELECT COUNT(*) INTO v_updated_files FROM updated;

    -- Update all nested folders recursively
    WITH RECURSIVE folder_tree AS (
        -- Start with direct child folders
        SELECT id, name, display_path, storage_path
        FROM files
        WHERE folder_id = p_folder_id AND type = 'folder/directory'
        
        UNION ALL
        
        -- Recursively get all nested folders
        SELECT f.id, f.name, f.display_path, f.storage_path
        FROM files f
        INNER JOIN folder_tree ft ON f.folder_id = ft.id
        WHERE f.type = 'folder/directory'
    ),
    updated_nested AS (
        UPDATE files f
        SET 
            storage_path = REPLACE(f.storage_path, v_old_storage_path, v_new_storage_path),
            display_path = REPLACE(f.display_path, v_old_display_path, v_new_display_path),
            updated_at = NOW()
        FROM folder_tree ft
        WHERE f.id = ft.id
        RETURNING f.id
    )
    SELECT COUNT(*) INTO v_updated_folders FROM updated_nested;

    -- Update files in nested folders
    WITH RECURSIVE folder_tree AS (
        SELECT id, name, display_path, storage_path
        FROM files
        WHERE folder_id = p_folder_id AND type = 'folder/directory'
        
        UNION ALL
        
        SELECT f.id, f.name, f.display_path, f.storage_path
        FROM files f
        INNER JOIN folder_tree ft ON f.folder_id = ft.id
        WHERE f.type = 'folder/directory'
    ),
    updated_nested_files AS (
        UPDATE files f
        SET 
            path = REPLACE(f.path, v_old_storage_path, v_new_storage_path),
            storage_path = REPLACE(f.storage_path, v_old_storage_path, v_new_storage_path),
            display_path = REPLACE(f.display_path, v_old_display_path, v_new_display_path),
            updated_at = NOW()
        FROM folder_tree ft
        WHERE f.folder_id = ft.id AND f.type != 'folder/directory'
        RETURNING f.id
    )
    SELECT COUNT(*) + v_updated_files INTO v_updated_files FROM updated_nested_files;

    -- Return summary
    RETURN json_build_object(
        'success', true,
        'folder_id', p_folder_id,
        'old_name', v_old_name,
        'new_name', p_new_name,
        'old_storage_path', v_old_storage_path,
        'new_storage_path', v_new_storage_path,
        'old_display_path', v_old_display_path,
        'new_display_path', v_new_display_path,
        'updated_files', v_updated_files,
        'updated_folders', v_updated_folders
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error renaming folder: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION rename_folder(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION rename_folder IS 'Renames a folder and updates all child files and folders paths consistently';
