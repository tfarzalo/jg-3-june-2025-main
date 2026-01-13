-- ==============================================================================
-- FINAL CLEANUP: REMOVE DUPLICATE WORK ORDER FOLDERS
-- ==============================================================================
-- 1. Identify duplicate folders (same name, same parent).
-- 2. Move contents from "Empty" duplicates to "Full" duplicates.
-- 3. Delete the empty duplicates.
-- 4. Re-add a constraint that allows duplicates ONLY if they are soft-deleted (optional, but skipping for now).

BEGIN;

DO $$
DECLARE
    r RECORD;
    v_keep_id UUID;
    v_discard_id UUID;
    v_moved_count INT;
BEGIN
    -- Loop through duplicates: Find folders with same name and same parent
    FOR r IN 
        SELECT name, folder_id, COUNT(*) 
        FROM files 
        WHERE type = 'folder/directory' 
        AND folder_id IS NOT NULL
        GROUP BY name, folder_id 
        HAVING COUNT(*) > 1
    LOOP
        -- Strategy: Keep the one created FIRST (likely by the trigger), merge the NEW one into it?
        -- OR: Keep the one that has files?
        
        -- Let's find the ID of the folder that HAS children (files)
        SELECT id INTO v_keep_id
        FROM files f
        WHERE f.name = r.name AND f.folder_id = r.folder_id
        AND EXISTS (SELECT 1 FROM files child WHERE child.folder_id = f.id)
        ORDER BY created_at ASC -- If multiple have files, keep oldest
        LIMIT 1;
        
        -- If no folder has files, just pick the oldest one to keep
        IF v_keep_id IS NULL THEN
            SELECT id INTO v_keep_id
            FROM files
            WHERE name = r.name AND folder_id = r.folder_id
            ORDER BY created_at ASC
            LIMIT 1;
        END IF;
        
        -- Now find the others (to discard)
        FOR v_discard_id IN 
            SELECT id FROM files 
            WHERE name = r.name AND folder_id = r.folder_id 
            AND id != v_keep_id
        LOOP
            -- Move any straggler children from discard -> keep
            UPDATE files 
            SET folder_id = v_keep_id 
            WHERE folder_id = v_discard_id;
            
            -- Delete the discard folder
            DELETE FROM files WHERE id = v_discard_id;
        END LOOP;
        
    END LOOP;
END $$;

-- 5. Fix ensure_folder_exists to be even stricter about reusing existing folders
--    to prevent future duplicates now that the constraint is gone.
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
    
    -- 1. Aggressive Lookup: Check Parent+Name (Most reliable)
    IF p_parent_folder_id IS NOT NULL THEN
        SELECT id INTO v_folder_id
        FROM files
        WHERE folder_id = p_parent_folder_id AND name = v_folder_name
        ORDER BY created_at ASC -- Pick the oldest one if duplicates exist
        LIMIT 1;
    END IF;
    
    -- 2. Secondary Lookup: Check Path
    IF v_folder_id IS NULL THEN
        SELECT id INTO v_folder_id
        FROM files
        WHERE path = p_path
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;
    
    -- 3. Create if missing
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

COMMIT;
