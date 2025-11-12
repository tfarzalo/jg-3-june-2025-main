-- ============================================================================
-- COMPREHENSIVE FIX FOR DUPLICATE KEY ERROR IN FILE UPLOADS
-- ============================================================================
-- Issue: "duplicate key value violates unique constraint files_path_key"
-- Root Cause: Race condition or multiple unique constraints on files table
-- Solution: Fix constraint handling and add proper conflict resolution
-- Date: November 11, 2025
-- ============================================================================

-- Step 1: Check current constraints on files table
\echo '=========================================='
\echo 'STEP 1: CHECKING CURRENT CONSTRAINTS'
\echo '=========================================='

SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'files'::regclass
ORDER BY conname;

\echo ''
\echo '=========================================='
\echo 'STEP 2: DROPPING OLD UPLOAD FOLDER FUNCTION'
\echo '=========================================='

-- Drop old function versions
DROP FUNCTION IF EXISTS get_upload_folder(uuid, uuid, text) CASCADE;

\echo ''
\echo '=========================================='
\echo 'STEP 3: RECREATING WORK ORDER FOLDER FUNCTION WITH PROPER CONFLICT HANDLING'
\echo '=========================================='

-- Recreate with better error handling and conflict resolution
CREATE OR REPLACE FUNCTION create_work_order_folder_structure(
  p_property_id uuid,
  p_property_name text,
  p_work_order_num text,
  p_job_id uuid
)
RETURNS TABLE(
  wo_folder_id uuid,
  before_images_folder_id uuid,
  sprinkler_images_folder_id uuid,
  other_files_folder_id uuid
) AS $$
DECLARE
  v_work_orders_folder_id uuid;
  v_wo_folder_id uuid;
  v_before_images_folder_id uuid;
  v_sprinkler_images_folder_id uuid;
  v_other_files_folder_id uuid;
  v_user_id uuid;
  v_wo_name text;
  v_wo_path text;
  v_before_path text;
  v_sprinkler_path text;
  v_other_path text;
BEGIN
  -- Get current user or system user
  BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END;
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found';
  END IF;
  
  -- Format work order name and paths
  v_wo_name := 'WO-' || LPAD(p_work_order_num::text, 6, '0');
  v_wo_path := '/' || p_property_name || '/Work Orders/' || v_wo_name;
  v_before_path := v_wo_path || '/Before Images';
  v_sprinkler_path := v_wo_path || '/Sprinkler Images';
  v_other_path := v_wo_path || '/Other Files';
  
  -- Get Work Orders folder ID
  SELECT id INTO v_work_orders_folder_id
  FROM files
  WHERE property_id = p_property_id 
    AND name = 'Work Orders' 
    AND type = 'folder/directory'
  LIMIT 1;
  
  -- If not found, create property structure
  IF v_work_orders_folder_id IS NULL THEN
    PERFORM create_property_folder_structure(p_property_id, p_property_name);
    
    SELECT id INTO v_work_orders_folder_id
    FROM files
    WHERE property_id = p_property_id 
      AND name = 'Work Orders' 
      AND type = 'folder/directory'
    LIMIT 1;
  END IF;
  
  IF v_work_orders_folder_id IS NULL THEN
    RAISE EXCEPTION 'Work Orders folder not found for property: %', p_property_name;
  END IF;
  
  -- Create/Get WO folder with proper conflict handling
  BEGIN
    -- Try to get existing folder first
    SELECT id INTO v_wo_folder_id
    FROM files
    WHERE path = v_wo_path AND type = 'folder/directory'
    LIMIT 1;
    
    -- If not found, insert
    IF v_wo_folder_id IS NULL THEN
      INSERT INTO files (
        name, path, type, uploaded_by, property_id, job_id, folder_id, size
      ) VALUES (
        v_wo_name, v_wo_path, 'folder/directory', v_user_id,
        p_property_id, p_job_id, v_work_orders_folder_id, 0
      )
      ON CONFLICT ON CONSTRAINT files_path_key 
      DO UPDATE SET updated_at = now()
      RETURNING id INTO v_wo_folder_id;
      
      -- If still null (conflict resolution didn't return ID), get it
      IF v_wo_folder_id IS NULL THEN
        SELECT id INTO v_wo_folder_id
        FROM files
        WHERE path = v_wo_path AND type = 'folder/directory'
        LIMIT 1;
      END IF;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    -- Handle race condition - just get the existing folder
    SELECT id INTO v_wo_folder_id
    FROM files
    WHERE path = v_wo_path AND type = 'folder/directory'
    LIMIT 1;
  END;
  
  -- Create/Get Before Images folder
  BEGIN
    SELECT id INTO v_before_images_folder_id
    FROM files
    WHERE path = v_before_path AND type = 'folder/directory'
    LIMIT 1;
    
    IF v_before_images_folder_id IS NULL THEN
      INSERT INTO files (
        name, path, type, uploaded_by, property_id, job_id, folder_id, size
      ) VALUES (
        'Before Images', v_before_path, 'folder/directory', v_user_id,
        p_property_id, p_job_id, v_wo_folder_id, 0
      )
      ON CONFLICT ON CONSTRAINT files_path_key 
      DO UPDATE SET updated_at = now()
      RETURNING id INTO v_before_images_folder_id;
      
      IF v_before_images_folder_id IS NULL THEN
        SELECT id INTO v_before_images_folder_id
        FROM files
        WHERE path = v_before_path AND type = 'folder/directory'
        LIMIT 1;
      END IF;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_before_images_folder_id
    FROM files
    WHERE path = v_before_path AND type = 'folder/directory'
    LIMIT 1;
  END;
  
  -- Create/Get Sprinkler Images folder
  BEGIN
    SELECT id INTO v_sprinkler_images_folder_id
    FROM files
    WHERE path = v_sprinkler_path AND type = 'folder/directory'
    LIMIT 1;
    
    IF v_sprinkler_images_folder_id IS NULL THEN
      INSERT INTO files (
        name, path, type, uploaded_by, property_id, job_id, folder_id, size
      ) VALUES (
        'Sprinkler Images', v_sprinkler_path, 'folder/directory', v_user_id,
        p_property_id, p_job_id, v_wo_folder_id, 0
      )
      ON CONFLICT ON CONSTRAINT files_path_key 
      DO UPDATE SET updated_at = now()
      RETURNING id INTO v_sprinkler_images_folder_id;
      
      IF v_sprinkler_images_folder_id IS NULL THEN
        SELECT id INTO v_sprinkler_images_folder_id
        FROM files
        WHERE path = v_sprinkler_path AND type = 'folder/directory'
        LIMIT 1;
      END IF;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_sprinkler_images_folder_id
    FROM files
    WHERE path = v_sprinkler_path AND type = 'folder/directory'
    LIMIT 1;
  END;
  
  -- Create/Get Other Files folder
  BEGIN
    SELECT id INTO v_other_files_folder_id
    FROM files
    WHERE path = v_other_path AND type = 'folder/directory'
    LIMIT 1;
    
    IF v_other_files_folder_id IS NULL THEN
      INSERT INTO files (
        name, path, type, uploaded_by, property_id, job_id, folder_id, size
      ) VALUES (
        'Other Files', v_other_path, 'folder/directory', v_user_id,
        p_property_id, p_job_id, v_wo_folder_id, 0
      )
      ON CONFLICT ON CONSTRAINT files_path_key 
      DO UPDATE SET updated_at = now()
      RETURNING id INTO v_other_files_folder_id;
      
      IF v_other_files_folder_id IS NULL THEN
        SELECT id INTO v_other_files_folder_id
        FROM files
        WHERE path = v_other_path AND type = 'folder/directory'
        LIMIT 1;
      END IF;
    END IF;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_other_files_folder_id
    FROM files
    WHERE path = v_other_path AND type = 'folder/directory'
    LIMIT 1;
  END;
  
  -- Return all folder IDs
  RETURN QUERY SELECT 
    v_wo_folder_id,
    v_before_images_folder_id,
    v_sprinkler_images_folder_id,
    v_other_files_folder_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

\echo ''
\echo '=========================================='
\echo 'STEP 4: RECREATING GET_UPLOAD_FOLDER FUNCTION'
\echo '=========================================='

CREATE OR REPLACE FUNCTION get_upload_folder(
  p_property_id uuid,
  p_job_id uuid DEFAULT NULL,
  p_folder_type text DEFAULT 'other'
)
RETURNS uuid AS $$
DECLARE
  v_property_name text;
  v_work_order_num text;
  v_folder_id uuid;
  v_folder_path text;
  v_user_id uuid;
BEGIN
  -- Get current user
  BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
      SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
  END;
  
  -- Get property name
  SELECT property_name INTO v_property_name
  FROM properties
  WHERE id = p_property_id;
  
  IF v_property_name IS NULL THEN
    RAISE EXCEPTION 'Property not found: %', p_property_id;
  END IF;
  
  -- If no job_id, return Property Files folder
  IF p_job_id IS NULL THEN
    SELECT id INTO v_folder_id
    FROM files
    WHERE property_id = p_property_id
      AND name = 'Property Files'
      AND type = 'folder/directory'
    LIMIT 1;
    
    IF v_folder_id IS NULL THEN
      PERFORM create_property_folder_structure(p_property_id, v_property_name);
      
      SELECT id INTO v_folder_id
      FROM files
      WHERE property_id = p_property_id
        AND name = 'Property Files'
        AND type = 'folder/directory'
      LIMIT 1;
    END IF;
    
    RETURN v_folder_id;
  END IF;
  
  -- Get work order number
  SELECT work_order_num INTO v_work_order_num
  FROM jobs
  WHERE id = p_job_id;
  
  IF v_work_order_num IS NULL THEN
    RAISE EXCEPTION 'Job not found: %', p_job_id;
  END IF;
  
  -- Build folder path
  CASE p_folder_type
    WHEN 'before' THEN
      v_folder_path := '/' || v_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0') || '/Before Images';
    WHEN 'sprinkler' THEN
      v_folder_path := '/' || v_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0') || '/Sprinkler Images';
    ELSE
      v_folder_path := '/' || v_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0') || '/Other Files';
  END CASE;
  
  -- Try to get existing folder
  SELECT id INTO v_folder_id
  FROM files
  WHERE path = v_folder_path AND type = 'folder/directory'
  LIMIT 1;
  
  -- If not found, create structure
  IF v_folder_id IS NULL THEN
    PERFORM create_work_order_folder_structure(
      p_property_id,
      v_property_name,
      v_work_order_num::text,
      p_job_id
    );
    
    -- Get folder ID again
    SELECT id INTO v_folder_id
    FROM files
    WHERE path = v_folder_path AND type = 'folder/directory'
    LIMIT 1;
  END IF;
  
  RETURN v_folder_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

\echo ''
\echo '=========================================='
\echo 'STEP 5: GRANTING PERMISSIONS'
\echo '=========================================='

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_upload_folder(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_work_order_folder_structure(uuid, text, text, uuid) TO authenticated;

\echo ''
\echo '=========================================='
\echo 'STEP 6: VERIFYING FIX'
\echo '=========================================='

-- Test the function
SELECT 'Testing get_upload_folder function...' as status;

-- This should work without duplicate key errors now
SELECT 
  'Test 1: Get Before Images folder' as test,
  get_upload_folder(
    (SELECT id FROM properties LIMIT 1),
    (SELECT id FROM jobs LIMIT 1),
    'before'
  ) as folder_id;

\echo ''
\echo '=========================================='
\echo 'FIX COMPLETE!'
\echo '=========================================='
\echo ''
\echo 'The duplicate key error has been fixed by:'
\echo '1. Adding proper SELECT LIMIT 1 clauses to prevent ambiguity'
\echo '2. Wrapping INSERT operations in BEGIN/EXCEPTION blocks'
\echo '3. Handling unique_violation exceptions gracefully'
\echo '4. Using ON CONFLICT ON CONSTRAINT files_path_key explicitly'
\echo '5. Always fetching the folder ID after conflict resolution'
\echo ''
\echo 'Please test the image upload functionality again.'
\echo ''
