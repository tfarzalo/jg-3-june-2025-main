-- ==============================================================================
-- FINAL DEFINITIVE FIX: REMOVE UNIQUE CONSTRAINT & FIX LOOKUP
-- ==============================================================================
-- 1. DROP the problematic unique constraint.
-- 2. RE-ADD it with less restrictive rules (optional) or just rely on logic.
-- 3. UPDATE ensure_folder_exists to be purely idempotent.

BEGIN;

-- 1. DROP CONSTRAINT
-- ==============================================================================
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_folder_id_name_key;

-- 2. UPDATE FUNCTION (Simplified & Robust)
-- ==============================================================================
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
    
    -- 1. Try to find existing folder (Check Parent+Name first)
    IF p_parent_folder_id IS NOT NULL THEN
        SELECT id INTO v_folder_id
        FROM files
        WHERE folder_id = p_parent_folder_id AND name = v_folder_name
        LIMIT 1;
    END IF;
    
    -- 2. If not found, Check Path
    IF v_folder_id IS NULL THEN
        SELECT id INTO v_folder_id
        FROM files
        WHERE path = p_path
        LIMIT 1;
    END IF;
    
    -- 3. If still not found, create it
    IF v_folder_id IS NULL THEN
        INSERT INTO files (
            name, path, type, folder_id, property_id, job_id, uploaded_by, size
        )
        VALUES (
            v_folder_name, p_path, 'folder/directory', p_parent_folder_id,
            p_property_id, p_job_id, v_user_id, 0
        )
        RETURNING id INTO v_folder_id;
    ELSE
        -- Self-healing: Ensure parent and type are correct
        UPDATE files 
        SET 
            folder_id = COALESCE(p_parent_folder_id, folder_id),
            type = 'folder/directory'
        WHERE id = v_folder_id;
    END IF;
    
    RETURN v_folder_id;
END;
$$;

COMMIT;
