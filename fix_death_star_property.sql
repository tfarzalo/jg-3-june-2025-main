-- ============================================================================
-- FIX Death Star Property File System
-- ============================================================================
-- This fixes the legacy folder and orphaned file for Death Star property
-- ============================================================================

-- Step 1: Show current state of Death Star property
SELECT 
    'Current State' as step,
    id,
    name,
    path,
    type,
    folder_id,
    property_id,
    job_id
FROM files
WHERE property_id = '1640d0de-e659-4796-a6da-f0301d1ed60a'
ORDER BY 
    CASE 
        WHEN folder_id IS NULL AND type = 'folder/directory' THEN 1
        WHEN name = 'Work Orders' THEN 2
        WHEN name = 'Property Files' THEN 3
        ELSE 4
    END,
    created_at;

-- ============================================================================
-- Step 2: Ensure proper folder structure exists for Death Star property
-- ============================================================================

SELECT * FROM ensure_property_folders_exist(
    '1640d0de-e659-4796-a6da-f0301d1ed60a'::uuid,
    'Death Star'
);

-- This will create the proper folder structure if it doesn't exist

-- ============================================================================
-- Step 3: Delete the legacy 'death_star' folder record (it's not needed)
-- ============================================================================

DELETE FROM files 
WHERE id = '341c2483-042e-45e5-a44e-ada11b40c309'
  AND name = 'death_star'
  AND type = 'folder';

-- This removes the old-format folder that's causing confusion

-- ============================================================================
-- Step 4: Assign the orphaned file to the correct Property Files folder
-- ============================================================================

DO $$
DECLARE
    v_property_files_folder_id UUID;
BEGIN
    -- Get the Property Files folder ID
    SELECT id INTO v_property_files_folder_id
    FROM files
    WHERE property_id = '1640d0de-e659-4796-a6da-f0301d1ed60a'
      AND name = 'Property Files'
      AND type = 'folder/directory'
    LIMIT 1;
    
    IF v_property_files_folder_id IS NULL THEN
        RAISE EXCEPTION 'Property Files folder not found! Run ensure_property_folders_exist first.';
    END IF;
    
    -- Update the orphaned file
    UPDATE files
    SET folder_id = v_property_files_folder_id
    WHERE id = 'b5d4d6a5-e1c7-428e-8a55-d8772cb7213d'
      AND property_id = '1640d0de-e659-4796-a6da-f0301d1ed60a';
    
    RAISE NOTICE 'Successfully assigned file to Property Files folder: %', v_property_files_folder_id;
END $$;

-- ============================================================================
-- Step 5: Verify the fix - Show updated state
-- ============================================================================

SELECT 
    'After Fix' as step,
    id,
    name,
    path,
    type,
    folder_id,
    property_id,
    job_id
FROM files
WHERE property_id = '1640d0de-e659-4796-a6da-f0301d1ed60a'
ORDER BY 
    CASE 
        WHEN folder_id IS NULL AND type = 'folder/directory' THEN 1
        WHEN name = 'Work Orders' THEN 2
        WHEN name = 'Property Files' THEN 3
        ELSE 4
    END,
    created_at;

-- ============================================================================
-- Step 6: Verify overall file system health
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

-- Expected: Orphaned Files = 0

-- ============================================================================
-- Step 7: Check for any remaining orphaned files
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
