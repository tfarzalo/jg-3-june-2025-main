-- Fix for duplicate key value violates unique constraint "files_folder_id_name_key"
-- This error occurs when ensuring a folder exists, but a race condition or mismatch in metadata 
-- causes the check to fail but the insert to collide with an existing folder.

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
    -- We intentionally loosen the property_id/job_id check here because the unique constraint 
    -- "files_folder_id_name_key" likely only covers (folder_id, name).
    -- If a folder exists with the same name in the same parent, we must return it
    -- rather than trying to insert and failing.
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
                -- This catches "files_folder_id_name_key" violation
                RAISE NOTICE 'Caught unique_violation for folder %, retrying lookup', p_path;
                
                -- Try to find it one last time by path
                SELECT id INTO v_folder_id
                FROM files
                WHERE path = p_path
                AND type = 'folder/directory'
                LIMIT 1;
                
                -- If not found by path, try by name/parent
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
                
                -- If we still can't find it, that's unexpected but we should avoid returning NULL if possible
                IF v_folder_id IS NULL THEN
                    RAISE WARNING 'Could not create or find folder after unique violation: %', p_path;
                END IF;
        END;
    END IF;
    
    RETURN v_folder_id;
END;
$$;
