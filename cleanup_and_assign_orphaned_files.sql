-- ============================================================================
-- CLEANUP ORPHANED FILES AND FIX FOLDER ASSIGNMENTS
-- ============================================================================
-- This script identifies orphaned files and either deletes them or assigns 
-- them to the correct property folders
-- ============================================================================

-- Step 1: Identify all orphaned files in root folder
SELECT 
    id,
    name,
    path,
    type,
    property_id,
    job_id,
    folder_id,
    created_at
FROM files
WHERE folder_id IS NULL 
  AND type != 'folder/directory'
ORDER BY created_at DESC;

-- Step 2: OPTION A - Delete all orphaned files (Use this if files are not needed)
-- CAUTION: This will permanently delete files from database and storage
-- Uncomment to execute:
/*
DO $$
DECLARE
    v_file_record RECORD;
    v_deleted_count INTEGER := 0;
BEGIN
    -- Loop through all orphaned files
    FOR v_file_record IN 
        SELECT id, path, name 
        FROM files 
        WHERE folder_id IS NULL 
          AND type != 'folder/directory'
    LOOP
        -- Delete from storage first
        BEGIN
            PERFORM FROM (
                SELECT supabase.storage_delete('files', v_file_record.path)
            ) AS result;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not delete from storage: %', v_file_record.path;
        END;
        
        -- Delete from database
        DELETE FROM files WHERE id = v_file_record.id;
        v_deleted_count := v_deleted_count + 1;
        
        RAISE NOTICE 'Deleted: % (ID: %)', v_file_record.name, v_file_record.id;
    END LOOP;
    
    RAISE NOTICE 'Total orphaned files deleted: %', v_deleted_count;
END $$;
*/

-- Step 3: OPTION B - Assign orphaned files to correct folders (Use this to preserve files)
-- This will attempt to match files to their correct property/job folders
DO $$
DECLARE
    v_file_record RECORD;
    v_property_files_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_assigned_count INTEGER := 0;
    v_failed_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting orphaned file cleanup and folder assignment...';
    
    -- Loop through orphaned files
    FOR v_file_record IN 
        SELECT id, name, path, property_id, job_id, type
        FROM files 
        WHERE folder_id IS NULL 
          AND type != 'folder/directory'
    LOOP
        -- Try to assign to Property Files folder if it's a property file
        IF v_file_record.property_id IS NOT NULL AND v_file_record.job_id IS NULL THEN
            -- Get Property Files folder ID
            SELECT id INTO v_property_files_folder_id
            FROM files
            WHERE property_id = v_file_record.property_id
              AND name = 'Property Files'
              AND type = 'folder/directory'
            LIMIT 1;
            
            IF v_property_files_folder_id IS NOT NULL THEN
                -- Update file with correct folder_id
                UPDATE files
                SET folder_id = v_property_files_folder_id
                WHERE id = v_file_record.id;
                
                v_assigned_count := v_assigned_count + 1;
                RAISE NOTICE 'Assigned to Property Files: % (ID: %)', v_file_record.name, v_file_record.id;
            ELSE
                v_failed_count := v_failed_count + 1;
                RAISE NOTICE 'No Property Files folder found for: % (Property: %)', 
                    v_file_record.name, v_file_record.property_id;
            END IF;
            
        -- Try to assign to Work Orders folder if it's a job file
        ELSIF v_file_record.job_id IS NOT NULL AND v_file_record.property_id IS NOT NULL THEN
            -- Get Work Orders parent folder
            SELECT id INTO v_work_orders_folder_id
            FROM files
            WHERE property_id = v_file_record.property_id
              AND name = 'Work Orders'
              AND type = 'folder/directory'
            LIMIT 1;
            
            IF v_work_orders_folder_id IS NOT NULL THEN
                -- Assign to Work Orders folder (or specific WO folder if path contains WO number)
                UPDATE files
                SET folder_id = v_work_orders_folder_id
                WHERE id = v_file_record.id;
                
                v_assigned_count := v_assigned_count + 1;
                RAISE NOTICE 'Assigned to Work Orders: % (ID: %)', v_file_record.name, v_file_record.id;
            ELSE
                v_failed_count := v_failed_count + 1;
                RAISE NOTICE 'No Work Orders folder found for: % (Job: %)', 
                    v_file_record.name, v_file_record.job_id;
            END IF;
        ELSE
            v_failed_count := v_failed_count + 1;
            RAISE NOTICE 'Cannot determine folder for: % (No property_id or job_id)', v_file_record.name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Cleanup complete!';
    RAISE NOTICE 'Files assigned to folders: %', v_assigned_count;
    RAISE NOTICE 'Files that could not be assigned: %', v_failed_count;
    RAISE NOTICE '===========================================';
END $$;

-- Step 4: Verify cleanup - check for remaining orphaned files
SELECT 
    COUNT(*) as remaining_orphaned_files
FROM files
WHERE folder_id IS NULL 
  AND type != 'folder/directory';

-- Step 5: Show summary of file distribution
SELECT 
    CASE 
        WHEN folder_id IS NULL AND type = 'folder/directory' THEN 'Root Folders'
        WHEN folder_id IS NULL THEN 'Orphaned Files'
        ELSE 'Files in Folders'
    END as category,
    COUNT(*) as count
FROM files
GROUP BY 
    CASE 
        WHEN folder_id IS NULL AND type = 'folder/directory' THEN 'Root Folders'
        WHEN folder_id IS NULL THEN 'Orphaned Files'
        ELSE 'Files in Folders'
    END
ORDER BY count DESC;
