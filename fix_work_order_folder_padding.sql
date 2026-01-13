-- ============================================================================
-- FIX DUPLICATE WORK ORDER FOLDERS (WITH AND WITHOUT PADDING)
-- ============================================================================
-- Issue: Work order folders are being created both as "WO-480" and "WO-000480"
-- Solution: Clean up duplicates and ensure all functions use LPAD for 6-digit format
-- Date: November 13, 2025
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'STEP 1: IDENTIFYING DUPLICATE FOLDERS';
    RAISE NOTICE '=========================================';
END $$;

-- Find work orders with duplicate folders
DO $$
DECLARE
    rec RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR rec IN 
        SELECT 
            j.work_order_num,
            j.id as job_id,
            STRING_AGG(f.name, ', ' ORDER BY LENGTH(f.name) DESC) as folder_names,
            COUNT(f.id) as folder_count
        FROM jobs j
        LEFT JOIN files f ON f.job_id = j.id 
            AND f.type = 'folder/directory'
            AND f.name LIKE 'WO-%'
        GROUP BY j.work_order_num, j.id
        HAVING COUNT(f.id) > 1
    LOOP
        v_count := v_count + 1;
        RAISE NOTICE 'Work Order %: % folders found: %', 
            rec.work_order_num, rec.folder_count, rec.folder_names;
    END LOOP;
    
    IF v_count = 0 THEN
        RAISE NOTICE 'No duplicate work order folders found';
    ELSE
        RAISE NOTICE 'Found % work orders with duplicate folders', v_count;
    END IF;
END $$;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'STEP 2: CLEANING UP DUPLICATES';
    RAISE NOTICE '=========================================';
END $$;

-- Clean up work order folders that don't have proper 6-digit padding
-- Keep the properly padded version (WO-000480), delete the unpadded (WO-480)
DO $$
DECLARE
    rec RECORD;
    v_deleted_count INTEGER := 0;
    v_moved_files INTEGER := 0;
BEGIN
    -- Find work orders with both padded and unpadded folders
    FOR rec IN
        SELECT 
            j.id as job_id,
            j.work_order_num,
            f_unpadded.id as unpadded_folder_id,
            f_unpadded.name as unpadded_name,
            f_unpadded.path as unpadded_path,
            f_padded.id as padded_folder_id,
            f_padded.name as padded_name,
            f_padded.path as padded_path
        FROM jobs j
        CROSS JOIN LATERAL (
            SELECT id, name, path
            FROM files
            WHERE job_id = j.id
                AND type = 'folder/directory'
                AND name = 'WO-' || j.work_order_num::text
            LIMIT 1
        ) f_unpadded
        CROSS JOIN LATERAL (
            SELECT id, name, path
            FROM files
            WHERE job_id = j.id
                AND type = 'folder/directory'
                AND name = 'WO-' || LPAD(j.work_order_num::text, 6, '0')
            LIMIT 1
        ) f_padded
        WHERE f_unpadded.id != f_padded.id
    LOOP
        RAISE NOTICE 'Processing WO-%: keeping %, removing %', 
            rec.work_order_num, rec.padded_name, rec.unpadded_name;
        
        -- Move files from unpadded folder to padded folder
        -- Handle conflicts: if a file with same name exists in destination, delete from source
        UPDATE files
        SET folder_id = rec.padded_folder_id
        WHERE folder_id = rec.unpadded_folder_id
        AND NOT EXISTS (
            SELECT 1 FROM files existing
            WHERE existing.folder_id = rec.padded_folder_id
            AND existing.name = files.name
        );
        
        GET DIAGNOSTICS v_moved_files = ROW_COUNT;
        IF v_moved_files > 0 THEN
            RAISE NOTICE '  Moved % files from unpadded to padded folder', v_moved_files;
        END IF;
        
        -- Delete any remaining files in unpadded folder (duplicates that couldn't be moved)
        DELETE FROM files 
        WHERE folder_id = rec.unpadded_folder_id;
        
        -- Delete the unpadded folder itself
        DELETE FROM files WHERE id = rec.unpadded_folder_id;
        v_deleted_count := v_deleted_count + 1;
        
        RAISE NOTICE '  Deleted unpadded folder';
    END LOOP;
    
    RAISE NOTICE 'Cleaned up % duplicate folders', v_deleted_count;
END $$;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'STEP 3: UPDATING TRIGGER FUNCTIONS';
    RAISE NOTICE '=========================================';
END $$;

-- Drop all existing work order folder creation triggers and functions
DROP TRIGGER IF EXISTS trigger_create_work_order_folder ON jobs;
DROP TRIGGER IF EXISTS create_work_order_folders_trigger ON work_orders;
DROP FUNCTION IF EXISTS create_work_order_folder() CASCADE;
DROP FUNCTION IF EXISTS create_work_order_folders() CASCADE;

-- Create a single, unified trigger function with proper padding
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

    -- IMPORTANT: Always use 6-digit padded format
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

    -- Construct the work order folder path with PADDED number
    v_work_order_folder_path := '/' || v_property_name || '/Work Orders/' || v_work_order_name;

    -- Insert or update the work order folder with PADDED name
    INSERT INTO files (name, path, folder_id, type, uploaded_by, property_id, job_id, size)
    VALUES (
        v_work_order_name,  -- WO-000480, NOT WO-480
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

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new jobs
CREATE TRIGGER trigger_create_work_order_folder
AFTER INSERT ON jobs
FOR EACH ROW
EXECUTE FUNCTION create_work_order_folder();

DO $$
BEGIN
    RAISE NOTICE 'Created unified work order folder trigger with proper padding';
END $$;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=========================================';
    RAISE NOTICE 'STEP 4: VERIFICATION';
    RAISE NOTICE '=========================================';
END $$;

-- Verify no unpadded folders remain
DO $$
DECLARE
    v_unpadded_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_unpadded_count
    FROM files f
    JOIN jobs j ON f.job_id = j.id
    WHERE f.type = 'folder/directory'
        AND f.name LIKE 'WO-%'
        AND f.name != 'WO-' || LPAD(j.work_order_num::text, 6, '0');
    
    IF v_unpadded_count > 0 THEN
        RAISE WARNING 'Found % work order folders without proper padding', v_unpadded_count;
    ELSE
        RAISE NOTICE 'All work order folders have proper 6-digit padding ✓';
    END IF;
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
    RAISE NOTICE '✓ Cleaned up duplicate folders';
    RAISE NOTICE '✓ Updated trigger function to always use 6-digit padding';
    RAISE NOTICE '✓ All work order folders will now be created as WO-000480 format';
    RAISE NOTICE '✓ No more WO-480 style folders will be created';
    RAISE NOTICE '';
END $$;
