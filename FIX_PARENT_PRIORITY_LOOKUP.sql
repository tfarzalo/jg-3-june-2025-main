-- ==============================================================================
-- FINAL FIX: PRIORITY PARENT LOOKUP
-- ==============================================================================
-- This script updates ensure_folder_exists to check (folder_id, name) FIRST.
-- This prevents "duplicate key" errors when the path string might mismatch slightly
-- but the logical parent/child relationship already exists.

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
    
    -- 1. PRIORITY LOOKUP: Check Parent + Name first (The Hard Constraint)
    -- This is the most reliable check because it matches the unique constraint that was failing.
    IF p_parent_folder_id IS NOT NULL THEN
        SELECT id INTO v_folder_id
        FROM files
        WHERE folder_id = p_parent_folder_id AND name = v_folder_name
        LIMIT 1;
    END IF;
    
    -- 2. SECONDARY LOOKUP: Check Path
    -- If we didn't find it by parent (or parent wasn't provided), try the path.
    IF v_folder_id IS NULL THEN
        SELECT id INTO v_folder_id
        FROM files
        WHERE path = p_path
        LIMIT 1;
    END IF;
    
    -- 3. CREATE if still not found
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
                -- Final safety net: catch race conditions
                SELECT id INTO v_folder_id
                FROM files
                WHERE path = p_path 
                   OR (folder_id = p_parent_folder_id AND name = v_folder_name)
                LIMIT 1;
        END;
    ELSE
        -- Self-healing: If found by Path but Parent is wrong/missing, fix it.
        IF p_parent_folder_id IS NOT NULL THEN
            UPDATE files 
            SET folder_id = p_parent_folder_id 
            WHERE id = v_folder_id AND (folder_id IS NULL OR folder_id != p_parent_folder_id);
        END IF;
    END IF;

    -- 4. Ensure Correct Type (UI Fix)
    IF v_folder_id IS NOT NULL THEN
        UPDATE files 
        SET type = 'folder/directory' 
        WHERE id = v_folder_id AND type != 'folder/directory';
    END IF;
    
    RETURN v_folder_id;
END;
$$;

COMMIT;
