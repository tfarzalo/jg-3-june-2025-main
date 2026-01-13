-- ==============================================================================
-- URGENT FIX: RUN THIS SCRIPT IN SUPABASE DASHBOARD SQL EDITOR
-- ==============================================================================
-- This script completely resets the folder creation logic to enforce the 
-- "/Properties" structure. It handles race conditions and removes all old triggers.

BEGIN;

-- 1. CLEANUP: Drop all existing triggers and functions to prevent conflicts
-- ==============================================================================
DROP TRIGGER IF EXISTS create_job_folder_trigger ON jobs;
DROP TRIGGER IF EXISTS trigger_create_work_order_folders ON jobs;
DROP TRIGGER IF EXISTS create_work_order_folder_trigger ON jobs;
DROP TRIGGER IF EXISTS property_create_folders_trigger ON properties;
DROP TRIGGER IF EXISTS create_property_folder_trigger ON properties;
DROP TRIGGER IF EXISTS trigger_create_property_folders ON properties;

-- Drop functions (cascade to ensure triggers are gone if missed above)
DROP FUNCTION IF EXISTS create_job_folder() CASCADE;
DROP FUNCTION IF EXISTS create_property_folder() CASCADE;
DROP FUNCTION IF EXISTS get_upload_folder(uuid, uuid, text) CASCADE;
-- Note: We keep ensure_folder_exists but will replace it below

-- 2. HELPER: Robust ensure_folder_exists with Race Condition Handling
-- ==============================================================================
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
    v_user_id UUID;
BEGIN
    -- Extract folder name from path
    v_folder_name := regexp_replace(p_path, '^.*/', '');
    
    -- Get system user if auth.uid() is null
    SELECT COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)) INTO v_user_id;
    
    -- 1. Try to find existing folder by path
    SELECT id INTO v_folder_id
    FROM files
    WHERE path = p_path
    AND type IN ('folder/directory', 'folder/job', 'folder/property')
    LIMIT 1;
    
    -- 2. If not found, create it with conflict handling
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
            SET name = EXCLUDED.name -- Dummy update to return ID
            RETURNING id INTO v_folder_id;
        EXCEPTION WHEN unique_violation THEN
            -- Race condition caught: folder was created by another process
            SELECT id INTO v_folder_id
            FROM files
            WHERE path = p_path AND type IN ('folder/directory', 'folder/job', 'folder/property')
            LIMIT 1;
        END;
    END IF;
    
    RETURN v_folder_id;
END;
$$;

-- 3. TRIGGER FUNCTION: create_property_folder (Enforce /Properties/)
-- ==============================================================================
CREATE OR REPLACE FUNCTION create_property_folder()
RETURNS TRIGGER AS $$
DECLARE
    v_properties_root_id UUID;
    v_property_folder_id UUID;
BEGIN
    -- 1. Ensure /Properties root exists
    v_properties_root_id := ensure_folder_exists('/Properties');

    -- 2. Ensure /Properties/{Name} exists
    v_property_folder_id := ensure_folder_exists(
        '/Properties/' || NEW.property_name,
        v_properties_root_id,
        NEW.id
    );
    
    -- Set specific type for property folder
    UPDATE files SET type = 'folder/property' WHERE id = v_property_folder_id;

    -- 3. Ensure subfolders
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

-- 4. TRIGGER FUNCTION: create_job_folder (Enforce /Properties/)
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
    -- Get Property Name
    SELECT property_name INTO v_property_name FROM properties WHERE id = NEW.property_id;
    
    IF v_property_name IS NULL THEN
        RETURN NEW;
    END IF;

    -- 1. Ensure /Properties root exists
    v_properties_root_id := ensure_folder_exists('/Properties');

    -- 2. Ensure /Properties/{Name} exists
    v_property_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name,
        v_properties_root_id,
        NEW.property_id
    );

    -- 3. Ensure Work Orders subfolder
    v_work_orders_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name || '/Work Orders',
        v_property_folder_id,
        NEW.property_id
    );

    -- 4. Create Job Folder: /Properties/{Name}/Work Orders/WO-{Num}
    v_work_order_num := 'WO-' || LPAD(NEW.work_order_num::text, 6, '0');
    
    v_job_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name || '/Work Orders/' || v_work_order_num,
        v_work_orders_folder_id,
        NEW.property_id,
        NEW.id
    );
    
    -- Set specific type for job folder
    UPDATE files SET type = 'folder/job' WHERE id = v_job_folder_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. UTILITY FUNCTION: get_upload_folder (Enforce /Properties/)
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
    -- Get property name
    SELECT property_name INTO v_property_name
    FROM properties WHERE id = p_property_id;
    
    -- Ensure /Properties root exists
    v_properties_root_id := ensure_folder_exists('/Properties');
    
    -- Ensure property folder exists
    v_property_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name, 
        v_properties_root_id, 
        p_property_id
    );
    
    -- Handle Property Files
    IF p_folder_type = 'property_files' THEN
        RETURN ensure_folder_exists(
            '/Properties/' || v_property_name || '/Property Files',
            v_property_folder_id, 
            p_property_id
        );
    END IF;
    
    -- Handle Work Order Files
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

COMMIT;
