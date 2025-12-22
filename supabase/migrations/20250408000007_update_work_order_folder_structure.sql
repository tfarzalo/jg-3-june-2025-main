-- Update Work Order Folder Structure
-- This migration updates the folder structure for work orders to be more organized and consistent

-- Drop existing triggers and functions to avoid conflicts
DROP TRIGGER IF EXISTS create_work_order_folders_trigger ON work_orders;
DROP FUNCTION IF EXISTS create_work_order_folders();

-- Create new function for work order folder creation
CREATE OR REPLACE FUNCTION create_work_order_folders()
RETURNS TRIGGER AS $$
DECLARE
    v_property_name text;
    v_work_order_num text;
    v_root_folder_id uuid;
    v_property_folder_id uuid;
    v_work_order_folder_id uuid;
BEGIN
    -- Get property name and work order number
    SELECT 
        p.property_name,
        'WO-' || LPAD(j.work_order_num::text, 6, '0')
    INTO 
        v_property_name,
        v_work_order_num
    FROM jobs j
    JOIN properties p ON p.id = j.property_id
    WHERE j.id = NEW.job_id;

    -- Create or get root Work Orders folder
    INSERT INTO files (
        name,
        type,
        path,
        uploaded_by
    )
    VALUES (
        'Work Orders',
        'folder/directory',
        '/Work Orders',
        auth.uid()
    )
    ON CONFLICT (path) DO NOTHING
    RETURNING id INTO v_root_folder_id;

    -- Get root folder ID if it already existed
    IF v_root_folder_id IS NULL THEN
        SELECT id INTO v_root_folder_id
        FROM files
        WHERE path = '/Work Orders';
    END IF;

    -- Create or get property folder
    INSERT INTO files (
        name,
        type,
        path,
        uploaded_by,
        folder_id
    )
    VALUES (
        v_property_name,
        'folder/directory',
        '/Work Orders/' || v_property_name,
        auth.uid(),
        v_root_folder_id
    )
    ON CONFLICT (path) DO NOTHING
    RETURNING id INTO v_property_folder_id;

    -- Get property folder ID if it already existed
    IF v_property_folder_id IS NULL THEN
        SELECT id INTO v_property_folder_id
        FROM files
        WHERE path = '/Work Orders/' || v_property_name;
    END IF;

    -- Create work order folder
    INSERT INTO files (
        name,
        type,
        path,
        uploaded_by,
        folder_id,
        job_id
    )
    VALUES (
        v_work_order_num,
        'folder/directory',
        '/Work Orders/' || v_property_name || '/' || v_work_order_num,
        auth.uid(),
        v_property_folder_id,
        NEW.job_id
    )
    ON CONFLICT (path) DO NOTHING
    RETURNING id INTO v_work_order_folder_id;

    -- Get work order folder ID if it already existed
    IF v_work_order_folder_id IS NULL THEN
        SELECT id INTO v_work_order_folder_id
        FROM files
        WHERE path = '/Work Orders/' || v_property_name || '/' || v_work_order_num;
    END IF;

    -- Create standard subfolders
    INSERT INTO files (
        name,
        type,
        path,
        uploaded_by,
        folder_id,
        job_id
    )
    VALUES 
    (
        'Before Images',
        'folder/directory',
        '/Work Orders/' || v_property_name || '/' || v_work_order_num || '/Before Images',
        auth.uid(),
        v_work_order_folder_id,
        NEW.job_id
    ),
    (
        'Sprinkler Images',
        'folder/directory',
        '/Work Orders/' || v_property_name || '/' || v_work_order_num || '/Sprinkler Images',
        auth.uid(),
        v_work_order_folder_id,
        NEW.job_id
    ),
    (
        'Other Files',
        'folder/directory',
        '/Work Orders/' || v_property_name || '/' || v_work_order_num || '/Other Files',
        auth.uid(),
        v_work_order_folder_id,
        NEW.job_id
    )
    ON CONFLICT (path) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for work order folder creation
CREATE TRIGGER create_work_order_folders_trigger
    AFTER INSERT ON work_orders
    FOR EACH ROW
    EXECUTE FUNCTION create_work_order_folders();

-- Create function to migrate existing work orders to new structure
CREATE OR REPLACE FUNCTION migrate_existing_work_order_folders()
RETURNS void AS $$
DECLARE
    v_work_order RECORD;
BEGIN
    FOR v_work_order IN 
        SELECT 
            wo.*,
            j.work_order_num,
            p.property_name,
            j.id as job_id
        FROM work_orders wo
        JOIN jobs j ON j.id = wo.job_id
        JOIN properties p ON p.id = j.property_id
    LOOP
        -- Call the folder creation function for each existing work order
        PERFORM create_work_order_folders() FROM work_orders WHERE id = v_work_order.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute migration for existing work orders
SELECT migrate_existing_work_order_folders();

-- Drop the migration function after use
DROP FUNCTION migrate_existing_work_order_folders(); 