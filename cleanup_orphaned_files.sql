-- Cleanup Orphaned Files Script
-- This script removes files that are not properly organized in the folder structure
-- Run this after implementing the comprehensive file management system

-- Step 1: Create a function to identify orphaned files
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS identify_orphaned_files();

CREATE OR REPLACE FUNCTION identify_orphaned_files()
RETURNS TABLE(
  file_id uuid,
  file_name text,
  file_path text,
  file_type text,
  reason text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.name,
    f.path,
    f.type,
    CASE 
      WHEN f.folder_id IS NULL AND f.type NOT LIKE 'folder/%' THEN 'No folder assigned'
      WHEN f.path NOT LIKE '%/Property Files/%' 
           AND f.path NOT LIKE '%/Work Orders/%' 
           AND f.path NOT LIKE '%/Before Images/%'
           AND f.path NOT LIKE '%/Sprinkler Images/%'
           AND f.path NOT LIKE '%/Other Files/%'
           AND f.type NOT LIKE 'folder/%' THEN 'Not in proper folder structure'
      WHEN f.type LIKE 'folder/%' AND f.path NOT LIKE '/%' THEN 'Invalid folder path'
      ELSE 'Unknown issue'
    END as reason
  FROM files f
  WHERE 
    -- Files not in folders (except root folders)
    (f.folder_id IS NULL AND f.type NOT LIKE 'folder/%')
    OR
    -- Files not in proper folder structure
    (f.type NOT LIKE 'folder/%' 
     AND f.path NOT LIKE '%/Property Files/%' 
     AND f.path NOT LIKE '%/Work Orders/%' 
     AND f.path NOT LIKE '%/Before Images/%'
     AND f.path NOT LIKE '%/Sprinkler Images/%'
     AND f.path NOT LIKE '%/Other Files/%'
     AND f.path NOT LIKE 'root/%')
    OR
    -- Invalid folder paths
    (f.type LIKE 'folder/%' AND f.path NOT LIKE '/%');
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create a function to safely delete orphaned files
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS cleanup_orphaned_files_safe();

CREATE OR REPLACE FUNCTION cleanup_orphaned_files_safe()
RETURNS TABLE(
  deleted_count INTEGER,
  storage_errors INTEGER,
  details TEXT[]
) AS $$
DECLARE
  v_file_record RECORD;
  v_deleted_count INTEGER := 0;
  v_storage_errors INTEGER := 0;
  v_details TEXT[] := ARRAY[]::TEXT[];
  v_error_text TEXT;
BEGIN
  -- Loop through orphaned files
  FOR v_file_record IN 
    SELECT * FROM identify_orphaned_files()
  LOOP
    BEGIN
      -- Try to delete from storage first
      BEGIN
        PERFORM storage.objects_delete('files', ARRAY[v_file_record.file_path]);
      EXCEPTION WHEN OTHERS THEN
        v_storage_errors := v_storage_errors + 1;
        v_error_text := 'Storage deletion failed for ' || v_file_record.file_name || ': ' || SQLERRM;
        v_details := array_append(v_details, v_error_text);
      END;
      
      -- Delete from database
      DELETE FROM files WHERE id = v_file_record.file_id;
      v_deleted_count := v_deleted_count + 1;
      v_details := array_append(v_details, 'Deleted: ' || v_file_record.file_name || ' (' || v_file_record.reason || ')');
      
    EXCEPTION WHEN OTHERS THEN
      v_error_text := 'Database deletion failed for ' || v_file_record.file_name || ': ' || SQLERRM;
      v_details := array_append(v_details, v_error_text);
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_deleted_count, v_storage_errors, v_details;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create a function to move files to proper locations
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS reorganize_files();

CREATE OR REPLACE FUNCTION reorganize_files()
RETURNS TABLE(
  moved_count INTEGER,
  errors INTEGER,
  details TEXT[]
) AS $$
DECLARE
  v_file_record RECORD;
  v_moved_count INTEGER := 0;
  v_errors INTEGER := 0;
  v_details TEXT[] := ARRAY[]::TEXT[];
  v_new_path TEXT;
  v_property_folder_id UUID;
  v_property_files_folder_id UUID;
  v_property_name TEXT;
BEGIN
  -- Find files that might be property unit maps
  FOR v_file_record IN 
    SELECT f.id, f.name, f.path, f.type, f.property_id, p.property_name
    FROM files f
    LEFT JOIN properties p ON p.id = f.property_id
    WHERE f.name LIKE '%unit-map%' 
      AND f.path NOT LIKE '%/Property Files/%'
      AND f.property_id IS NOT NULL
  LOOP
    BEGIN
      -- Get Property Files folder ID
      SELECT id INTO v_property_files_folder_id
      FROM files
      WHERE path = '/' || v_property_record.property_name || '/Property Files' 
        AND type = 'folder/directory';
      
      IF v_property_files_folder_id IS NOT NULL THEN
        -- Move file to Property Files folder
        v_new_path := v_property_record.property_name || '/Property Files/' || v_file_record.name;
        
        UPDATE files
        SET 
          path = v_new_path,
          folder_id = v_property_files_folder_id
        WHERE id = v_file_record.id;
        
        v_moved_count := v_moved_count + 1;
        v_details := array_append(v_details, 'Moved unit map: ' || v_file_record.name);
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      v_details := array_append(v_details, 'Error moving ' || v_file_record.name || ': ' || SQLERRM);
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_moved_count, v_errors, v_details;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Main cleanup procedure
-- Drop existing function if it exists
DROP FUNCTION IF EXISTS perform_file_cleanup();

CREATE OR REPLACE FUNCTION perform_file_cleanup()
RETURNS TABLE(
  action TEXT,
  count INTEGER,
  details TEXT[]
) AS $$
DECLARE
  v_reorganized RECORD;
  v_cleaned RECORD;
BEGIN
  -- First, try to reorganize files
  SELECT * INTO v_reorganized FROM reorganize_files();
  
  RETURN QUERY SELECT 
    'Reorganized'::TEXT,
    v_reorganized.moved_count,
    v_reorganized.details;
  
  -- Then, clean up remaining orphaned files
  SELECT * INTO v_cleaned FROM cleanup_orphaned_files_safe();
  
  RETURN QUERY SELECT 
    'Cleaned'::TEXT,
    v_cleaned.deleted_count,
    v_cleaned.details;
  
  -- Report storage errors
  IF v_cleaned.storage_errors > 0 THEN
    RETURN QUERY SELECT 
      'Storage Errors'::TEXT,
      v_cleaned.storage_errors,
      ARRAY['Some files could not be deleted from storage. Check storage bucket manually.']::TEXT[];
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create a view for monitoring file organization
-- Drop existing view if it exists
DROP VIEW IF EXISTS file_organization_status;

CREATE OR REPLACE VIEW file_organization_status AS
SELECT 
  'Total Files' as category,
  COUNT(*) as count
FROM files
WHERE type NOT LIKE 'folder/%'

UNION ALL

SELECT 
  'Files in Property Folders' as category,
  COUNT(*) as count
FROM files
WHERE type NOT LIKE 'folder/%' 
  AND (path LIKE '%/Property Files/%' OR path LIKE '%/Work Orders/%')

UNION ALL

SELECT 
  'Orphaned Files' as category,
  COUNT(*) as count
FROM identify_orphaned_files()

UNION ALL

SELECT 
  'Property Folders' as category,
  COUNT(*) as count
FROM files
WHERE type = 'folder/directory' 
  AND path LIKE '/%' 
  AND path NOT LIKE '%/%/%'

UNION ALL

SELECT 
  'Work Order Folders' as category,
  COUNT(*) as count
FROM files
WHERE type = 'folder/directory' 
  AND path LIKE '%/Work Orders/%'

UNION ALL

SELECT 
  'Property Files Folders' as category,
  COUNT(*) as count
FROM files
WHERE type = 'folder/directory' 
  AND path LIKE '%/Property Files';

-- Usage Instructions:
-- 1. First, check the current status:
--    SELECT * FROM file_organization_status;
--
-- 2. Identify orphaned files:
--    SELECT * FROM identify_orphaned_files();
--
-- 3. Perform the cleanup:
--    SELECT * FROM perform_file_cleanup();
--
-- 4. Verify the results:
--    SELECT * FROM file_organization_status;

-- Comments
COMMENT ON FUNCTION identify_orphaned_files IS 'Identifies files that are not properly organized in the folder structure';
COMMENT ON FUNCTION cleanup_orphaned_files_safe IS 'Safely deletes orphaned files from both database and storage';
COMMENT ON FUNCTION reorganize_files IS 'Attempts to move files to their proper locations before deletion';
COMMENT ON FUNCTION perform_file_cleanup IS 'Main cleanup procedure that reorganizes and cleans up files';
COMMENT ON VIEW file_organization_status IS 'Provides an overview of file organization status';
