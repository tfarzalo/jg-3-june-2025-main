-- FINAL FIX ALL FOLDER LOGIC
-- ============================================================================
-- This script forcefully updates ALL database functions and triggers related to
-- folder creation to ensure they ALWAYS use the "/Properties" folder structure.
-- It also handles race conditions and prevents duplicate key errors.
-- ============================================================================

BEGIN;

-- 1. Ensure the Root "Properties" Folder Exists
-- ============================================================================
DO $$
DECLARE
    v_system_user UUID;
BEGIN
    SELECT id INTO v_system_user FROM auth.users ORDER BY created_at ASC LIMIT 1;
    
    INSERT INTO files (name, path, type, uploaded_by, size)
    VALUES ('Properties', '/Properties', 'folder/directory', v_system_user, 0)
    ON CONFLICT (path) DO NOTHING;
END $$;


-- 2. Define "ensure_folder_exists" Helper (Robust & Safe)
-- ============================================================================
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
    
    -- Get current user or system user
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


-- 3. Redefine "create_property_folder" Trigger Function
-- ============================================================================
CREATE OR REPLACE FUNCTION create_property_folder()
RETURNS TRIGGER AS $$
DECLARE
    v_properties_root_id UUID;
    v_property_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_property_files_folder_id UUID;
BEGIN
    -- 1. Ensure /Properties root exists
    v_properties_root_id := ensure_folder_exists('/Properties');

    -- 2. Ensure /Properties/{Name} exists
    v_property_folder_id := ensure_folder_exists(
        '/Properties/' || NEW.property_name,
        v_properties_root_id,
        NEW.id
    );
    
    -- Update the folder type to 'folder/property' specifically
    UPDATE files SET type = 'folder/property' WHERE id = v_property_folder_id;

    -- 3. Ensure Work Orders subfolder
    v_work_orders_folder_id := ensure_folder_exists(
        '/Properties/' || NEW.property_name || '/Work Orders',
        v_property_folder_id,
        NEW.id
    );

    -- 4. Ensure Property Files subfolder
    v_property_files_folder_id := ensure_folder_exists(
        '/Properties/' || NEW.property_name || '/Property Files',
        v_property_folder_id,
        NEW.id
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 4. Redefine "create_job_folder" Trigger Function
-- ============================================================================
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
        RAISE WARNING 'Property not found for job %', NEW.id;
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
    
    -- Update folder type to 'folder/job'
    UPDATE files SET type = 'folder/job' WHERE id = v_job_folder_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 5. Redefine "get_upload_folder" Function (Used by Frontend)
-- ============================================================================
-- First drop to avoid signature conflicts
DROP FUNCTION IF EXISTS get_upload_folder(uuid, uuid, text);

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
    
    IF v_property_name IS NULL THEN
        RAISE EXCEPTION 'Property not found: %', p_property_id;
    END IF;
    
    -- Ensure /Properties root exists
    v_properties_root_id := ensure_folder_exists('/Properties');
    
    -- Ensure property folder exists
    v_property_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name, 
        v_properties_root_id, 
        p_property_id
    );
    
    -- Handle Property Files (Unit Maps, etc.)
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
        
        -- Ensure Work Orders root exists
        v_work_orders_folder_id := ensure_folder_exists(
            '/Properties/' || v_property_name || '/Work Orders',
            v_property_folder_id, 
            p_property_id
        );
        
        -- Ensure specific WO folder exists
        v_wo_folder_id := ensure_folder_exists(
            '/Properties/' || v_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0'),
            v_work_orders_folder_id, 
            p_property_id, 
            p_job_id
        );
        
        -- Determine subfolder name
        v_folder_name := CASE p_folder_type
            WHEN 'before' THEN 'Before Images'
            WHEN 'after' THEN 'After Images'
            WHEN 'sprinkler' THEN 'Sprinkler Images'
            WHEN 'job_files' THEN 'Job Files'
            ELSE 'Other Files'
        END;
        
        -- Return final target folder ID
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


-- 6. Attach Triggers (Cleanup old ones first)
-- ============================================================================

-- Property Triggers
DROP TRIGGER IF EXISTS create_property_folder_trigger ON properties;
DROP TRIGGER IF EXISTS trigger_create_property_folders ON properties;
DROP TRIGGER IF EXISTS property_create_folders_trigger ON properties;

CREATE TRIGGER create_property_folder_trigger
AFTER INSERT ON properties
FOR EACH ROW
EXECUTE FUNCTION create_property_folder();

-- Job Triggers
DROP TRIGGER IF EXISTS create_job_folder_trigger ON jobs;
DROP TRIGGER IF EXISTS trigger_create_work_order_folders ON jobs;

CREATE TRIGGER create_job_folder_trigger
AFTER INSERT ON jobs
FOR EACH ROW
EXECUTE FUNCTION create_job_folder();


COMMIT;
