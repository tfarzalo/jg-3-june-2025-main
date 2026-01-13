-- ==============================================================================
-- FINAL DEFINITIVE FIX: FOLDER STRUCTURE & TYPES
-- ==============================================================================
-- This script fixes the folder structure logic to strictly enforce /Properties/...
-- AND sets the correct folder types so they appear as folders in the UI.

BEGIN;

-- 1. DROP EVERYTHING related to old logic
-- ==============================================================================
DROP TRIGGER IF EXISTS create_job_folder_trigger ON jobs;
DROP TRIGGER IF EXISTS trigger_create_work_order_folders ON jobs;
DROP TRIGGER IF EXISTS create_work_order_folder_trigger ON jobs;
DROP TRIGGER IF EXISTS property_create_folders_trigger ON properties;
DROP TRIGGER IF EXISTS create_property_folder_trigger ON properties;
DROP TRIGGER IF EXISTS trigger_create_property_folders ON properties;

DROP FUNCTION IF EXISTS create_job_folder() CASCADE;
DROP FUNCTION IF EXISTS create_property_folder() CASCADE;
DROP FUNCTION IF EXISTS get_upload_folder(uuid, uuid, text) CASCADE;

-- 2. HELPER: ensure_folder_exists (Strict & Safe)
-- ==============================================================================
CREATE OR REPLACE FUNCTION ensure_folder_exists(
    p_path TEXT,
    p_parent_folder_id UUID DEFAULT NULL,
    p_property_id UUID DEFAULT NULL,
    p_job_id UUID DEFAULT NULL,
    p_folder_type TEXT DEFAULT 'folder/directory' -- Default to directory for safety
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
    
    -- Get system user
    SELECT COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)) INTO v_user_id;
    
    -- 1. Try to find existing folder
    SELECT id INTO v_folder_id
    FROM files
    WHERE path = p_path
    AND type LIKE 'folder/%' -- Match any folder type
    LIMIT 1;
    
    -- 2. If not found, create it
    IF v_folder_id IS NULL THEN
        BEGIN
            INSERT INTO files (
                name, path, type, folder_id, property_id, job_id, uploaded_by, size
            )
            VALUES (
                v_folder_name, p_path, p_folder_type, p_parent_folder_id,
                p_property_id, p_job_id, v_user_id, 0
            )
            ON CONFLICT (path) DO UPDATE
            SET name = EXCLUDED.name
            RETURNING id INTO v_folder_id;
        EXCEPTION WHEN unique_violation THEN
            -- Handle race condition
            SELECT id INTO v_folder_id
            FROM files
            WHERE path = p_path AND type LIKE 'folder/%'
            LIMIT 1;
        END;
    END IF;

    -- 3. Ensure it has the correct type (fix existing "files" that should be folders)
    -- We only update if it's currently not a folder type or if we want to enforce specific types
    -- For now, ensure it starts with 'folder/'
    UPDATE files 
    SET type = p_folder_type 
    WHERE id = v_folder_id 
    AND type NOT LIKE 'folder/%'; -- Fix items that became "files" by mistake
    
    RETURN v_folder_id;
END;
$$;

-- 3. TRIGGER: create_property_folder
-- ==============================================================================
CREATE OR REPLACE FUNCTION create_property_folder()
RETURNS TRIGGER AS $$
DECLARE
    v_properties_root_id UUID;
    v_property_folder_id UUID;
BEGIN
    -- 1. /Properties
    v_properties_root_id := ensure_folder_exists('/Properties', NULL, NULL, NULL, 'folder/directory');

    -- 2. /Properties/{Name}
    v_property_folder_id := ensure_folder_exists(
        '/Properties/' || NEW.property_name,
        v_properties_root_id,
        NEW.id,
        NULL,
        'folder/property' -- Use semantic type
    );

    -- 3. Subfolders
    PERFORM ensure_folder_exists(
        '/Properties/' || NEW.property_name || '/Work Orders',
        v_property_folder_id,
        NEW.id,
        NULL,
        'folder/directory'
    );

    PERFORM ensure_folder_exists(
        '/Properties/' || NEW.property_name || '/Property Files',
        v_property_folder_id,
        NEW.id,
        NULL,
        'folder/directory'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. TRIGGER: create_job_folder
-- ==============================================================================
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

    -- 1. Ensure Path Exists (Idempotent)
    v_properties_root_id := ensure_folder_exists('/Properties', NULL, NULL, NULL, 'folder/directory');

    v_property_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name,
        v_properties_root_id,
        NEW.property_id,
        NULL,
        'folder/property'
    );

    v_work_orders_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name || '/Work Orders',
        v_property_folder_id,
        NEW.property_id,
        NULL,
        'folder/directory'
    );

    -- 2. Create Job Folder
    v_work_order_num := 'WO-' || LPAD(NEW.work_order_num::text, 6, '0');
    
    v_job_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name || '/Work Orders/' || v_work_order_num,
        v_work_orders_folder_id,
        NEW.property_id,
        NEW.id,
        'folder/job' -- Semantic type
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. FUNCTION: get_upload_folder
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
    
    -- Ensure root path exists
    v_properties_root_id := ensure_folder_exists('/Properties', NULL, NULL, NULL, 'folder/directory');
    
    v_property_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name, 
        v_properties_root_id, 
        p_property_id,
        NULL,
        'folder/property'
    );
    
    IF p_folder_type = 'property_files' THEN
        RETURN ensure_folder_exists(
            '/Properties/' || v_property_name || '/Property Files',
            v_property_folder_id, 
            p_property_id,
            NULL,
            'folder/directory'
        );
    END IF;
    
    IF p_job_id IS NOT NULL THEN
        SELECT work_order_num INTO v_work_order_num FROM jobs WHERE id = p_job_id;
        
        v_work_orders_folder_id := ensure_folder_exists(
            '/Properties/' || v_property_name || '/Work Orders',
            v_property_folder_id, 
            p_property_id,
            NULL,
            'folder/directory'
        );
        
        v_wo_folder_id := ensure_folder_exists(
            '/Properties/' || v_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0'),
            v_work_orders_folder_id, 
            p_property_id, 
            p_job_id,
            'folder/job'
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
            p_job_id,
            'folder/directory'
        );
    END IF;
    
    RAISE EXCEPTION 'Invalid parameters for get_upload_folder';
END;
$$;

-- 6. RE-APPLY TRIGGERS
-- ==============================================================================
CREATE TRIGGER create_property_folder_trigger
AFTER INSERT ON properties
FOR EACH ROW
EXECUTE FUNCTION create_property_folder();

CREATE TRIGGER create_job_folder_trigger
AFTER INSERT ON jobs
FOR EACH ROW
EXECUTE FUNCTION create_job_folder();

-- 7. CLEANUP: FIX EXISTING BAD TYPES
-- ==============================================================================
-- Fix any "files" that look like property folders
UPDATE files 
SET type = 'folder/property' 
WHERE path LIKE '/Properties/%' 
AND path NOT LIKE '/Properties/%/%' -- Top level under Properties
AND type NOT LIKE 'folder/%';

-- Fix any "files" that look like job folders
UPDATE files 
SET type = 'folder/job' 
WHERE path LIKE '%/Work Orders/WO-%' 
AND path NOT LIKE '%/Work Orders/WO-%/%' -- No subfolders
AND type NOT LIKE 'folder/%';

COMMIT;
