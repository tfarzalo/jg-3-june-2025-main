-- ============================================================================
-- SIMPLE FIX: Death Star Orphaned File
-- ============================================================================
-- This is a simple manual fix that doesn't require the rename_folder function
-- ============================================================================

-- Step 1: Show current state
SELECT 
    'BEFORE FIX' as status,
    id,
    name,
    path,
    type,
    folder_id,
    property_id
FROM files
WHERE property_id = '1640d0de-e659-4796-a6da-f0301d1ed60a'
ORDER BY 
    CASE WHEN folder_id IS NULL THEN 1 ELSE 2 END,
    type DESC,
    name;

-- ============================================================================
-- Step 2: Check if 'death_star' folder has children
-- ============================================================================

SELECT 
    'Children of death_star folder' as note,
    COUNT(*) as child_count
FROM files
WHERE folder_id = '341c2483-042e-45e5-a44e-ada11b40c309';

-- If this returns 0, the folder is empty and can be safely deleted

-- ============================================================================
-- Step 3: Manually assign the orphaned file to the death_star folder
-- ============================================================================
-- This is the simplest fix - just put the file in the existing folder

UPDATE files
SET folder_id = '341c2483-042e-45e5-a44e-ada11b40c309'
WHERE id = 'b5d4d6a5-e1c7-428e-8a55-d8772cb7213d';

-- ============================================================================
-- Step 4: Verify the fix
-- ============================================================================

SELECT 
    'AFTER FIX' as status,
    id,
    name,
    path,
    type,
    folder_id,
    property_id
FROM files
WHERE property_id = '1640d0de-e659-4796-a6da-f0301d1ed60a'
ORDER BY 
    CASE WHEN folder_id IS NULL THEN 1 ELSE 2 END,
    type DESC,
    name;

-- ============================================================================
-- Step 5: Check overall orphaned files count
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

-- Expected: Orphaned Files should now be 0

-- ============================================================================
-- NOTES:
-- ============================================================================
-- This simple fix just assigns the orphaned file to the existing 'death_star' folder.
-- The folder name isn't perfect (lowercase, no space), but it will work fine.
-- The file will be accessible in the File Manager and will display correctly.
--
-- To properly rename the folder to 'Death Star' with proper capitalization,
-- you need to first run this migration:
-- /supabase/migrations/20250120000020_add_rename_folder_function.sql
--
-- Then you can use the File Manager UI rename feature (pencil icon).
