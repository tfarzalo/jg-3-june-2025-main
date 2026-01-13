-- ============================================================================
-- QUICK REFERENCE: SQL Commands for Property File Upload Fix
-- ============================================================================
-- Copy and paste these commands as needed
-- ============================================================================

-- =============================================================================
-- CLEANUP ORPHANED FILES - OPTION B (ASSIGN TO FOLDERS) - RECOMMENDED
-- =============================================================================
-- This will attempt to match orphaned files to their correct folders

DO $$
DECLARE
    v_file_record RECORD;
    v_property_files_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_assigned_count INTEGER := 0;
    v_failed_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting orphaned file cleanup and folder assignment...';
    
    FOR v_file_record IN 
        SELECT id, name, path, property_id, job_id, type
        FROM files 
        WHERE folder_id IS NULL 
          AND type != 'folder/directory'
    LOOP
        -- Try to assign to Property Files folder if it's a property file
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
                RAISE NOTICE 'Assigned to Property Files: % (ID: %)', v_file_record.name, v_file_record.id;
            ELSE
                v_failed_count := v_failed_count + 1;
                RAISE NOTICE 'No Property Files folder found for: % (Property: %)', 
                    v_file_record.name, v_file_record.property_id;
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

-- =============================================================================
-- VERIFICATION: Check for remaining orphaned files
-- =============================================================================

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

-- This should return 0 rows after cleanup

-- =============================================================================
-- VERIFICATION: Check all properties have complete folder structures
-- =============================================================================

SELECT 
    p.id,
    p.property_name,
    COUNT(DISTINCT CASE WHEN f.name = 'Work Orders' THEN f.id END) as has_work_orders,
    COUNT(DISTINCT CASE WHEN f.name = 'Property Files' THEN f.id END) as has_property_files
FROM properties p
LEFT JOIN files f ON f.property_id = p.id AND f.type = 'folder/directory'
GROUP BY p.id, p.property_name
HAVING 
    COUNT(DISTINCT CASE WHEN f.name = 'Work Orders' THEN f.id END) = 0
    OR COUNT(DISTINCT CASE WHEN f.name = 'Property Files' THEN f.id END) = 0;

-- This should return 0 rows (no properties missing folders)

-- =============================================================================
-- VERIFICATION: Summary of file distribution
-- =============================================================================

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

-- Expected output:
-- Root Folders: (count of property root folders)
-- Files in Folders: (most files should be here)
-- Orphaned Files: 0 (after cleanup)

-- =============================================================================
-- OPTIONAL: Delete specific orphaned file
-- =============================================================================

-- Replace <file-id> with the actual file ID
-- DELETE FROM files WHERE id = '<file-id>'::uuid;

-- =============================================================================
-- OPTIONAL: Manually create folders for a specific property
-- =============================================================================

-- Replace <property-id> and <property-name> with actual values
-- SELECT * FROM ensure_property_folders_exist(
--     '<property-id>'::uuid,
--     '<property-name>'
-- );

-- =============================================================================
-- TEST: Check if prepare_property_for_file_upload function works
-- =============================================================================

-- Replace <property-id> with actual property ID
-- SELECT * FROM prepare_property_for_file_upload('<property-id>'::uuid);

-- Expected JSON response:
-- {
--   "success": true,
--   "property_folder_id": "...",
--   "work_orders_folder_id": "...",
--   "property_files_folder_id": "...",
--   "folders_existed": true,
--   "folders_created": false,
--   "message": "Folders already exist"
-- }
