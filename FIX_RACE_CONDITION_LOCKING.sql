-- ==============================================================================
-- FINAL NUCLEAR OPTION: SERIALIZED LOCKING
-- ==============================================================================
-- The issue is a "Race Condition" where two processes run ensure_folder_exists
-- at the EXACT same time. Both see "no folder", so both insert.
-- We fix this by using explicit advisory locks to force them to run one-by-one.

BEGIN;

-- 1. Redefine ensure_folder_exists with LOCKING
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
    v_lock_key BIGINT;
BEGIN
    v_folder_name := regexp_replace(p_path, '^.*/', '');
    
    -- Generate a lock key based on the parent folder ID (or a hash of the path)
    -- This ensures that operations on the SAME folder are serialized.
    IF p_parent_folder_id IS NOT NULL THEN
        v_lock_key := ('x' || substr(md5(p_parent_folder_id::text), 1, 15))::bit(64)::bigint;
    ELSE
        v_lock_key := ('x' || substr(md5(p_path), 1, 15))::bit(64)::bigint;
    END IF;
    
    -- ACQUIRE LOCK (Waits until other transactions finish)
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)) INTO v_user_id;
    
    -- 1. Check Parent+Name (Inside the lock)
    IF p_parent_folder_id IS NOT NULL THEN
        SELECT id INTO v_folder_id
        FROM files
        WHERE folder_id = p_parent_folder_id AND name = v_folder_name
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;
    
    -- 2. Check Path (Inside the lock)
    IF v_folder_id IS NULL THEN
        SELECT id INTO v_folder_id
        FROM files
        WHERE path = p_path
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;
    
    -- 3. Create (Inside the lock)
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
        -- Update metadata
        UPDATE files 
        SET 
            folder_id = COALESCE(p_parent_folder_id, folder_id),
            type = 'folder/directory'
        WHERE id = v_folder_id;
    END IF;
    
    RETURN v_folder_id;
END;
$$;

-- 2. CLEANUP AGAIN (Just in case)
-- ==============================================================================
DO $$
DECLARE
    r RECORD;
    v_keep_id UUID;
    v_discard_id UUID;
BEGIN
    FOR r IN 
        SELECT name, folder_id, COUNT(*) 
        FROM files 
        WHERE type = 'folder/directory' 
        AND folder_id IS NOT NULL
        GROUP BY name, folder_id 
        HAVING COUNT(*) > 1
    LOOP
        SELECT id INTO v_keep_id
        FROM files f
        WHERE f.name = r.name AND f.folder_id = r.folder_id
        AND EXISTS (SELECT 1 FROM files child WHERE child.folder_id = f.id)
        ORDER BY created_at ASC LIMIT 1;
        
        IF v_keep_id IS NULL THEN
            SELECT id INTO v_keep_id FROM files WHERE name = r.name AND folder_id = r.folder_id ORDER BY created_at ASC LIMIT 1;
        END IF;
        
        DELETE FROM files WHERE name = r.name AND folder_id = r.folder_id AND id != v_keep_id;
    END LOOP;
END $$;

COMMIT;
