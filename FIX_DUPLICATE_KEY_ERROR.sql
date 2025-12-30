-- ==============================================================================
-- FINAL FIX: HANDLE DUPLICATE KEY ERRORS
-- ==============================================================================
-- This script updates ensure_folder_exists to correctly handle cases where 
-- a folder exists but has a different type (e.g. 'folder/job'), preventing 
-- duplicate key errors during insertion.

BEGIN;

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
    
    -- 1. Try to find existing folder (Ignore Type!)
    -- This is crucial: if it exists as 'folder/job', we must find it, not try to create it again.
    SELECT id INTO v_folder_id
    FROM files
    WHERE path = p_path
    LIMIT 1;
    
    -- 2. If not found by path, try by (parent, name) if parent is known
    -- This handles cases where path might be slightly different but logical location is same
    IF v_folder_id IS NULL AND p_parent_folder_id IS NOT NULL THEN
        SELECT id INTO v_folder_id
        FROM files
        WHERE folder_id = p_parent_folder_id AND name = v_folder_name
        LIMIT 1;
    END IF;
    
    -- 3. If still not found, create it
    IF v_folder_id IS NULL THEN
        BEGIN
            INSERT INTO files (
                name, path, type, folder_id, property_id, job_id, uploaded_by, size
            )
            VALUES (
                v_folder_name, p_path, 'folder/directory', p_parent_folder_id,
                p_property_id, p_job_id, v_user_id, 0
            )
            RETURNING id INTO v_folder_id;
        EXCEPTION 
            WHEN unique_violation THEN
                -- Catch ANY unique violation (path OR folder_id+name)
                -- This specifically fixes the "duplicate key value violates unique constraint" error
                SELECT id INTO v_folder_id
                FROM files
                WHERE path = p_path 
                   OR (folder_id = p_parent_folder_id AND name = v_folder_name)
                LIMIT 1;
        END;
    END IF;

    -- 4. Ensure Correct Type (Self-Healing)
    -- If we found an old 'folder/job', convert it to 'folder/directory' so it shows in UI
    IF v_folder_id IS NOT NULL THEN
        UPDATE files 
        SET type = 'folder/directory' 
        WHERE id = v_folder_id AND type != 'folder/directory';
    END IF;
    
    RETURN v_folder_id;
END;
$$;

COMMIT;
