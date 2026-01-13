-- ==============================================================================
-- EMERGENCY FIX: REVERT TYPES & LINK ORPHANS
-- ==============================================================================

BEGIN;

-- 1. REVERT TYPES: Change everything back to 'folder/directory'
-- This fixes the "converted to file" issue immediately.
-- ==============================================================================
UPDATE files 
SET type = 'folder/directory' 
WHERE type IN ('folder/property', 'folder/job');


-- 2. FIX ORPHANS: Move Root items into /Properties if they belong there
-- ==============================================================================
DO $$
DECLARE
    v_properties_root_id UUID;
BEGIN
    -- Get ID of /Properties folder
    SELECT id INTO v_properties_root_id FROM files WHERE path = '/Properties';
    
    -- If /Properties exists, find items that should be inside it but are at Root
    IF v_properties_root_id IS NOT NULL THEN
        UPDATE files
        SET folder_id = v_properties_root_id
        WHERE folder_id IS NULL 
        AND path LIKE '/Properties/%' -- Path says it is inside
        AND path NOT LIKE '/Properties/%/%' -- It is a direct child (Property folder)
        AND id != v_properties_root_id; -- Don't move itself
    END IF;
END $$;


-- 3. UPDATE FUNCTION: ensure_folder_exists (Use 'folder/directory' ONLY)
-- ==============================================================================
CREATE OR REPLACE FUNCTION ensure_folder_exists(
    p_path TEXT,
    p_parent_folder_id UUID DEFAULT NULL,
    p_property_id UUID DEFAULT NULL,
    p_job_id UUID DEFAULT NULL,
    p_folder_type TEXT DEFAULT 'folder/directory' -- Ignored now, always forced
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
    
    -- ALWAYS use 'folder/directory' to avoid UI bugs
    
    -- 1. Try to find existing folder
    SELECT id INTO v_folder_id
    FROM files
    WHERE path = p_path
    AND type = 'folder/directory'
    LIMIT 1;
    
    -- 2. If not found, create it
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
            SET 
                folder_id = EXCLUDED.folder_id, -- Fix parent if wrong
                type = 'folder/directory'       -- Enforce type
            RETURNING id INTO v_folder_id;
        EXCEPTION WHEN unique_violation THEN
            SELECT id INTO v_folder_id
            FROM files
            WHERE path = p_path AND type = 'folder/directory'
            LIMIT 1;
        END;
    ELSE
        -- If found, ensure parent is correct (Self-Healing)
        IF p_parent_folder_id IS NOT NULL THEN
            UPDATE files 
            SET folder_id = p_parent_folder_id 
            WHERE id = v_folder_id AND folder_id IS NULL;
        END IF;
    END IF;
    
    RETURN v_folder_id;
END;
$$;


-- 4. UPDATE TRIGGERS: Remove custom types
-- ==============================================================================

-- Property Trigger
CREATE OR REPLACE FUNCTION create_property_folder()
RETURNS TRIGGER AS $$
DECLARE
    v_properties_root_id UUID;
    v_property_folder_id UUID;
BEGIN
    -- 1. /Properties
    v_properties_root_id := ensure_folder_exists('/Properties');

    -- 2. /Properties/{Name}
    v_property_folder_id := ensure_folder_exists(
        '/Properties/' || NEW.property_name,
        v_properties_root_id,
        NEW.id
    );

    -- 3. Subfolders
    PERFORM ensure_folder_exists(
        '/Properties/' || NEW.property_name || '/Work Orders',
        v_property_folder_id,
        NEW.id
    );

    PERFORM ensure_folder_exists(
        '/Properties/' || NEW.property_name || '/Property Files',
        v_property_folder_id,
        NEW.id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Job Trigger
CREATE OR REPLACE FUNCTION create_job_folder()
RETURNS TRIGGER AS $$
DECLARE
    v_property_name TEXT;
    v_properties_root_id UUID;
    v_property_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_job_folder_id UUID;
    v_work_order_num TEXT;
BEGIN
    SELECT property_name INTO v_property_name FROM properties WHERE id = NEW.property_id;
    IF v_property_name IS NULL THEN RETURN NEW; END IF;

    -- 1. Ensure Path Hierarchy
    v_properties_root_id := ensure_folder_exists('/Properties');

    v_property_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name,
        v_properties_root_id,
        NEW.property_id
    );

    v_work_orders_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name || '/Work Orders',
        v_property_folder_id,
        NEW.property_id
    );

    -- 2. Create Job Folder
    v_work_order_num := 'WO-' || LPAD(NEW.work_order_num::text, 6, '0');
    
    v_job_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name || '/Work Orders/' || v_work_order_num,
        v_work_orders_folder_id,
        NEW.property_id,
        NEW.id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. UPDATE get_upload_folder: Match new logic
-- ==============================================================================
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
    v_folder_name TEXT;
BEGIN
    SELECT property_name INTO v_property_name
    FROM properties WHERE id = p_property_id;
    
    v_properties_root_id := ensure_folder_exists('/Properties');
    
    v_property_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name, 
        v_properties_root_id, 
        p_property_id
    );
    
    IF p_folder_type = 'property_files' THEN
        RETURN ensure_folder_exists(
            '/Properties/' || v_property_name || '/Property Files',
            v_property_folder_id, 
            p_property_id
        );
    END IF;
    
    IF p_job_id IS NOT NULL THEN
        SELECT work_order_num INTO v_work_order_num FROM jobs WHERE id = p_job_id;
        
        v_work_orders_folder_id := ensure_folder_exists(
            '/Properties/' || v_property_name || '/Work Orders',
            v_property_folder_id, 
            p_property_id
        );
        
        v_wo_folder_id := ensure_folder_exists(
            '/Properties/' || v_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0'),
            v_work_orders_folder_id, 
            p_property_id, 
            p_job_id
        );
        
        v_folder_name := CASE p_folder_type
            WHEN 'before' THEN 'Before Images'
            WHEN 'after' THEN 'After Images'
            WHEN 'sprinkler' THEN 'Sprinkler Images'
            WHEN 'job_files' THEN 'Job Files'
            ELSE 'Other Files'
        END;
        
        RETURN ensure_folder_exists(
            '/Properties/' || v_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0') || '/' || v_folder_name,
            v_wo_folder_id, 
            p_property_id, 
            p_job_id
        );
    END IF;
    
    RAISE EXCEPTION 'Invalid parameters for get_upload_folder';
END;
$$;

COMMIT;
