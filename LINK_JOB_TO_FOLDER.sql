-- ==============================================================================
-- FINAL ARCHITECTURAL FIX: LINK JOB TO FOLDER
-- ==============================================================================
-- 1. Add folder_id to jobs table.
-- 2. Update trigger to save the folder ID to the job.
-- 3. Backfill existing jobs.

BEGIN;

-- 1. Add Column
-- ==============================================================================
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES files(id);

-- 2. Update Trigger Function
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
    
    IF v_property_name IS NULL THEN
        RETURN NEW;
    END IF;

    -- 1. Ensure /Properties root exists
    v_properties_root_id := ensure_folder_exists('/Properties', NULL, NULL, NULL, 'folder/directory');

    -- 2. Ensure /Properties/{Name} exists
    v_property_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name,
        v_properties_root_id,
        NEW.property_id,
        NULL,
        'folder/directory'
    );

    -- 3. Ensure Work Orders subfolder
    v_work_orders_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name || '/Work Orders',
        v_property_folder_id,
        NEW.property_id,
        NULL,
        'folder/directory'
    );

    -- 4. Create Job Folder: /Properties/{Name}/Work Orders/WO-{Num}
    v_work_order_num := 'WO-' || LPAD(NEW.work_order_num::text, 6, '0');
    
    v_job_folder_id := ensure_folder_exists(
        '/Properties/' || v_property_name || '/Work Orders/' || v_work_order_num,
        v_work_orders_folder_id,
        NEW.property_id,
        NEW.id,
        'folder/directory'
    );
    
    -- 5. LINK JOB TO FOLDER (The Fix)
    -- We update the job record with the folder we just found/created.
    -- This avoids any need for the frontend to guess.
    UPDATE jobs SET folder_id = v_job_folder_id WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Backfill (Optional, but good for consistency)
-- ==============================================================================
-- Update jobs that don't have a folder_id but have a linked folder in files
UPDATE jobs j
SET folder_id = f.id
FROM files f
WHERE j.folder_id IS NULL
AND f.job_id = j.id
AND f.type = 'folder/directory';

COMMIT;
