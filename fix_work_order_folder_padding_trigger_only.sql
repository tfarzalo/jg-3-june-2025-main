-- ============================================================================
-- FIX WORK ORDER FOLDER CREATION - 6-DIGIT PADDING ONLY
-- ============================================================================
-- Ensures all new work order folders use WO-000480 format (not WO-480)
-- Does NOT modify existing folders - only fixes future folder creation
-- Date: November 13, 2025
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'UPDATING WORK ORDER FOLDER TRIGGER';
    RAISE NOTICE '=========================================';
END $$;

-- Drop all existing work order folder creation triggers and functions
DROP TRIGGER IF EXISTS trigger_create_work_order_folder ON jobs;
DROP TRIGGER IF EXISTS create_work_order_folders_trigger ON work_orders;
DROP FUNCTION IF EXISTS create_work_order_folder() CASCADE;
DROP FUNCTION IF EXISTS create_work_order_folders() CASCADE;

DO $$
BEGIN
    RAISE NOTICE 'Dropped old triggers and functions';
END $$;

-- Create a single, unified trigger function with proper 6-digit padding
CREATE OR REPLACE FUNCTION create_work_order_folder()
RETURNS TRIGGER AS $$
DECLARE
    v_property_folder_id uuid;
    v_work_orders_folder_id uuid;
    v_work_order_folder_path text;
    v_work_order_name text;
    v_user_id uuid;
    v_property_name text;
BEGIN
    -- Get current user or system user
    BEGIN
        v_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        SELECT id INTO v_user_id 
        FROM auth.users 
        ORDER BY created_at ASC 
        LIMIT 1;
    END;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No user found for folder creation';
    END IF;

    -- Get property name
    SELECT property_name INTO v_property_name 
    FROM properties 
    WHERE id = NEW.property_id;
    
    IF v_property_name IS NULL THEN
        RAISE EXCEPTION 'Property not found for property_id: %', NEW.property_id;
    END IF;

    -- IMPORTANT: Always use 6-digit padded format (WO-000480, NOT WO-480)
    v_work_order_name := 'WO-' || LPAD(NEW.work_order_num::text, 6, '0');

    -- Get or create property folder
    SELECT id INTO v_property_folder_id 
    FROM files 
    WHERE property_id = NEW.property_id 
        AND type = 'folder/directory' 
        AND folder_id IS NULL
    LIMIT 1;

    IF v_property_folder_id IS NULL THEN
        -- Create property folder if it doesn't exist
        INSERT INTO files (name, path, folder_id, type, uploaded_by, property_id, size)
        VALUES (
            v_property_name, 
            '/' || v_property_name, 
            NULL, 
            'folder/directory', 
            v_user_id, 
            NEW.property_id,
            0
        )
        ON CONFLICT (path) DO UPDATE SET
            name = EXCLUDED.name,
            property_id = EXCLUDED.property_id
        RETURNING id INTO v_property_folder_id;
    END IF;

    -- Get or create Work Orders folder
    SELECT id INTO v_work_orders_folder_id
    FROM files
    WHERE property_id = NEW.property_id
        AND name = 'Work Orders'
        AND type = 'folder/directory'
        AND folder_id = v_property_folder_id
    LIMIT 1;

    IF v_work_orders_folder_id IS NULL THEN
        INSERT INTO files (name, path, folder_id, type, uploaded_by, property_id, size)
        VALUES (
            'Work Orders',
            '/' || v_property_name || '/Work Orders',
            v_property_folder_id,
            'folder/directory',
            v_user_id,
            NEW.property_id,
            0
        )
        ON CONFLICT (path) DO UPDATE SET
            name = EXCLUDED.name,
            folder_id = EXCLUDED.folder_id,
            property_id = EXCLUDED.property_id
        RETURNING id INTO v_work_orders_folder_id;
    END IF;

    -- Construct the work order folder path with 6-DIGIT PADDED number
    v_work_order_folder_path := '/' || v_property_name || '/Work Orders/' || v_work_order_name;

    -- Insert or update the work order folder with 6-DIGIT PADDED name
    INSERT INTO files (name, path, folder_id, type, uploaded_by, property_id, job_id, size)
    VALUES (
        v_work_order_name,  -- Always WO-000480, NEVER WO-480
        v_work_order_folder_path,
        v_work_orders_folder_id,
        'folder/directory',
        v_user_id,
        NEW.property_id,
        NEW.id,
        0
    )
    ON CONFLICT (path) DO UPDATE SET
        name = EXCLUDED.name,
        folder_id = EXCLUDED.folder_id,
        property_id = EXCLUDED.property_id,
        job_id = EXCLUDED.job_id;

    RAISE NOTICE 'Created work order folder: % (6-digit padded)', v_work_order_name;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
    RAISE NOTICE 'Created new work order folder function with 6-digit padding';
END $$;

-- Create trigger for new jobs
CREATE TRIGGER trigger_create_work_order_folder
AFTER INSERT ON jobs
FOR EACH ROW
EXECUTE FUNCTION create_work_order_folder();

DO $$
BEGIN
    RAISE NOTICE 'Created trigger for new jobs';
END $$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_work_order_folder() TO authenticated;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'FIX COMPLETE!';
    RAISE NOTICE '=========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '✓ Updated trigger function to always use 6-digit padding';
    RAISE NOTICE '✓ All NEW work order folders will be created as WO-000480 format';
    RAISE NOTICE '✓ Existing folders left unchanged';
    RAISE NOTICE '✓ No more WO-480 style folders will be created';
    RAISE NOTICE '';
    RAISE NOTICE 'Test by creating a new work order and verify folder format';
    RAISE NOTICE '';
END $$;
