-- ============================================================================
-- DIAGNOSE Death Star Folder Structure
-- ============================================================================

-- Step 1: Check ALL folders for Death Star property
SELECT 
    id,
    name,
    path,
    type,
    folder_id,
    property_id,
    created_at
FROM files
WHERE property_id = '1640d0de-e659-4796-a6da-f0301d1ed60a'
  AND type = 'folder/directory'
ORDER BY 
    CASE WHEN folder_id IS NULL THEN 1 ELSE 2 END,
    name;

-- Expected: Should show if there are duplicate folders

-- ============================================================================
-- Step 2: Check if Property Files and Work Orders folders already exist
-- ============================================================================

SELECT 
    f.id,
    f.name,
    f.path,
    f.folder_id,
    pf.name as parent_folder_name
FROM files f
LEFT JOIN files pf ON pf.id = f.folder_id
WHERE f.property_id = '1640d0de-e659-4796-a6da-f0301d1ed60a'
  AND f.type = 'folder/directory'
  AND f.name IN ('Work Orders', 'Property Files')
ORDER BY f.name;

-- ============================================================================
-- Step 3: Show the orphaned file details
-- ============================================================================

SELECT 
    id,
    name,
    path,
    type,
    folder_id,
    property_id,
    job_id,
    created_at
FROM files
WHERE id = 'b5d4d6a5-e1c7-428e-8a55-d8772cb7213d';

-- ============================================================================
-- SOLUTION OPTIONS:
-- ============================================================================

-- OPTION A: Use File Manager UI to rename 'death_star' folder to 'Death Star'
--   1. Open File Manager in your app
--   2. Find the 'death_star' folder
--   3. Click the pencil icon to rename
--   4. Enter 'Death Star' as the new name
--   5. The rename_folder function will fix everything automatically

-- OPTION B: If there are duplicate folders, delete the legacy one first
--   Run this ONLY if you see duplicate root folders for Death Star:
--   
--   DELETE FROM files 
--   WHERE id = '341c2483-042e-45e5-a44e-ada11b40c309'
--     AND name = 'death_star'
--     AND type = 'folder';
--   
--   Then manually assign the orphaned file to the correct Property Files folder

-- OPTION C: Manual fix if rename doesn't work
--   See fix_death_star_manual.sql for step-by-step manual approach
