-- ============================================================================
-- FIX ORPHANED FILES - Run this to fix your 2 orphaned files
-- ============================================================================
-- Copy and paste this ENTIRE file into Supabase SQL Editor and run it
-- ============================================================================

-- Step 1: First, let's see what the orphaned files are
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

-- ============================================================================
-- Step 2: Fix the orphaned files by assigning them to correct folders
-- ============================================================================

DO $$
DECLARE
    v_file_record RECORD;
    v_property_files_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_assigned_count INTEGER := 0;
    v_failed_count INTEGER := 0;
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Starting orphaned file cleanup...';
    RAISE NOTICE '============================================';
    
    FOR v_file_record IN 
        SELECT id, name, path, property_id, job_id, type
        FROM files 
        WHERE folder_id IS NULL 
          AND type != 'folder/directory'
    LOOP
        RAISE NOTICE '';
        RAISE NOTICE 'Processing: %', v_file_record.name;
        RAISE NOTICE '  ID: %', v_file_record.id;
        RAISE NOTICE '  Path: %', v_file_record.path;
        RAISE NOTICE '  Property ID: %', v_file_record.property_id;
        RAISE NOTICE '  Job ID: %', v_file_record.job_id;
        
        -- Try to assign to Property Files folder if it's a property file (no job_id)
        IF v_file_record.property_id IS NOT NULL AND v_file_record.job_id IS NULL THEN
            SELECT id INTO v_property_files_folder_id
            FROM files
            WHERE property_id = v_file_record.property_id
              AND name = 'Property Files'
              AND type = 'folder/directory'
            LIMIT 1;
            
            IF v_property_files_folder_id IS NOT NULL THEN
                UPDATE files
                SET folder_id = v_property_files_folder_id
                WHERE id = v_file_record.id;
                
                v_assigned_count := v_assigned_count + 1;
                RAISE NOTICE '  ✓ Assigned to Property Files folder (ID: %)', v_property_files_folder_id;
            ELSE
                v_failed_count := v_failed_count + 1;
                RAISE NOTICE '  ✗ No Property Files folder found for property: %', v_file_record.property_id;
            END IF;
            
        -- Try to assign to Work Orders folder if it's a job file
        ELSIF v_file_record.job_id IS NOT NULL AND v_file_record.property_id IS NOT NULL THEN
            SELECT id INTO v_work_orders_folder_id
            FROM files
            WHERE property_id = v_file_record.property_id
              AND name = 'Work Orders'
              AND type = 'folder/directory'
            LIMIT 1;
            
            IF v_work_orders_folder_id IS NOT NULL THEN
                UPDATE files
                SET folder_id = v_work_orders_folder_id
                WHERE id = v_file_record.id;
                
                v_assigned_count := v_assigned_count + 1;
                RAISE NOTICE '  ✓ Assigned to Work Orders folder (ID: %)', v_work_orders_folder_id;
            ELSE
                v_failed_count := v_failed_count + 1;
                RAISE NOTICE '  ✗ No Work Orders folder found for property: %', v_file_record.property_id;
            END IF;
        ELSE
            v_failed_count := v_failed_count + 1;
            RAISE NOTICE '  ✗ Cannot determine folder (missing property_id or job_id)';
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Cleanup complete!';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Files successfully assigned: %', v_assigned_count;
    RAISE NOTICE 'Files that could not be assigned: %', v_failed_count;
    RAISE NOTICE '============================================';
END $$;

-- ============================================================================
-- Step 3: Verify no orphaned files remain
-- ============================================================================

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

-- Expected result: Orphaned Files should now be 0

-- ============================================================================
-- Step 4: Show any remaining orphaned files (should be empty)
-- ============================================================================

SELECT 
    id,
    name,
    path,
    type,
    property_id,
    job_id,
    created_at
FROM files
WHERE folder_id IS NULL 
  AND type != 'folder/directory'
ORDER BY created_at DESC;

-- This should return 0 rows
