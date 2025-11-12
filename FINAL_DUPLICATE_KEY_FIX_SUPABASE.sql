-- ============================================================================
-- FINAL DUPLICATE KEY FIX - SUPABASE VERSION
-- ============================================================================
-- This version is compatible with Supabase SQL Editor (no \echo commands)
-- Run this in the Supabase SQL Editor
--
-- Date: November 11, 2025
-- Issue: duplicate key value violates unique constraint "files_path_key"
-- Root Cause: Folder creation functions try to insert duplicate paths
-- ============================================================================

-- =============================================================================
-- PART 1: IDENTIFY AND CLEAN UP DUPLICATE PATHS
-- =============================================================================

DO $$
DECLARE
    v_duplicate_count INTEGER;
    v_orphan_count INTEGER;
    rec RECORD;
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'STEP 1: IDENTIFYING DUPLICATE PATHS';
    RAISE NOTICE '===========================================';
    
    -- Count duplicate paths
    SELECT COUNT(*) INTO v_duplicate_count
    FROM (
        SELECT path, COUNT(*) as count
        FROM files
        WHERE type = 'folder/directory'
        GROUP BY path
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RAISE NOTICE 'Found % duplicate paths', v_duplicate_count;
    
    IF v_duplicate_count > 0 THEN
        RAISE NOTICE 'Duplicate paths found:';
        
        -- Show duplicate paths
        FOR rec IN 
            SELECT path, COUNT(*) as count
            FROM files
            WHERE type = 'folder/directory'
            GROUP BY path
            HAVING COUNT(*) > 1
            ORDER BY path
        LOOP
            RAISE NOTICE '  Path: %, Count: %', rec.path, rec.count;
        END LOOP;
        
        RAISE NOTICE 'Cleaning up duplicates...';
        
        -- Keep the oldest folder for each duplicate path, delete the rest
        DELETE FROM files f1
        WHERE f1.type = 'folder/directory'
        AND f1.id NOT IN (
            SELECT MIN(f2.id)
            FROM files f2
            WHERE f2.path = f1.path
            GROUP BY f2.path
        )
        AND f1.path IN (
            SELECT path
            FROM files
            WHERE type = 'folder/directory'
            GROUP BY path
            HAVING COUNT(*) > 1
        );
        
        RAISE NOTICE 'Duplicates cleaned up!';
    ELSE
        RAISE NOTICE 'No duplicate paths found - database is clean!';
    END IF;
    
    -- Check for orphaned files (files with null folder_id that should have one)
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'STEP 2: CHECKING FOR ORPHANED FILES';
    RAISE NOTICE '===========================================';
    
    SELECT COUNT(*) INTO v_orphan_count
    FROM files
    WHERE type != 'folder/directory'
    AND folder_id IS NULL
    AND job_id IS NOT NULL;
    
    RAISE NOTICE 'Found % orphaned files (with job_id but no folder_id)', v_orphan_count;
    
    IF v_orphan_count > 0 THEN
        RAISE NOTICE 'Note: These files may need manual review';
    END IF;
END $$;

-- =============================================================================
-- PART 2: CREATE HELPER FUNCTION FOR SAFE FOLDER CREATION
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'STEP 3: CREATING HELPER FUNCTIONS';
    RAISE NOTICE '===========================================';
END $$;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS ensure_folder_exists(TEXT, UUID, UUID, UUID);

-- Create new safe folder creation function
CREATE OR REPLACE FUNCTION ensure_folder_exists(
    p_path TEXT,
    p_parent_folder_id UUID DEFAULT NULL,
    p_property_id UUID DEFAULT NULL,
    p_job_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_folder_id UUID;
    v_folder_name TEXT;
BEGIN
    -- Extract folder name from path
    v_folder_name := regexp_replace(p_path, '^.*/', '');
    
    -- Try to find existing folder by path first
    SELECT id INTO v_folder_id
    FROM files
    WHERE path = p_path
    AND type = 'folder/directory'
    LIMIT 1;
    
    -- If not found by path, try by name and parent
    IF v_folder_id IS NULL THEN
        SELECT id INTO v_folder_id
        FROM files
        WHERE name = v_folder_name
        AND type = 'folder/directory'
        AND (
            (p_parent_folder_id IS NULL AND folder_id IS NULL) OR
            (folder_id = p_parent_folder_id)
        )
        AND (
            (p_property_id IS NULL AND property_id IS NULL) OR
            (property_id = p_property_id)
        )
        LIMIT 1;
    END IF;
    
    -- If still not found, create it
    IF v_folder_id IS NULL THEN
        INSERT INTO files (
            name,
            path,
            type,
            folder_id,
            property_id,
            job_id,
            uploaded_by
        )
        VALUES (
            v_folder_name,
            p_path,
            'folder/directory',
            p_parent_folder_id,
            p_property_id,
            p_job_id,
            auth.uid()
        )
        ON CONFLICT (path) DO UPDATE
        SET name = EXCLUDED.name
        RETURNING id INTO v_folder_id;
    END IF;
    
    RETURN v_folder_id;
END;
$$;

DO $$
BEGIN
    RAISE NOTICE 'Created ensure_folder_exists() function';
END $$;

-- =============================================================================
-- PART 3: UPDATE get_upload_folder FUNCTION
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'STEP 4: UPDATING get_upload_folder()';
    RAISE NOTICE '===========================================';
END $$;

DROP FUNCTION IF EXISTS get_upload_folder(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION get_upload_folder(
    p_property_id UUID,
    p_job_id UUID,
    p_folder_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_property_name TEXT;
    v_work_order_num INTEGER;
    v_folder_path TEXT;
    v_property_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_wo_folder_id UUID;
    v_target_folder_id UUID;
    v_sanitized_property_name TEXT;
    v_folder_name TEXT;
BEGIN
    -- Get property name
    SELECT property_name INTO v_property_name
    FROM properties
    WHERE id = p_property_id;
    
    IF v_property_name IS NULL THEN
        RAISE EXCEPTION 'Property not found: %', p_property_id;
    END IF;
    
    -- Sanitize property name for folder path
    v_sanitized_property_name := regexp_replace(v_property_name, '[^a-zA-Z0-9\s-]', '', 'g');
    v_sanitized_property_name := regexp_replace(v_sanitized_property_name, '\s+', ' ', 'g');
    v_sanitized_property_name := trim(v_sanitized_property_name);
    
    -- STEP 1: Ensure property root folder exists
    v_property_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name,
        NULL,
        p_property_id,
        NULL
    );
    
    -- For property files (unit maps, etc.)
    IF p_folder_type = 'property_files' THEN
        v_target_folder_id := ensure_folder_exists(
            '/' || v_sanitized_property_name || '/Property Files',
            v_property_folder_id,
            p_property_id,
            NULL
        );
        
        SELECT path INTO v_folder_path
        FROM files
        WHERE id = v_target_folder_id;
        
        RETURN v_folder_path;
    END IF;
    
    -- For work order files
    IF p_job_id IS NOT NULL THEN
        -- Get work order number
        SELECT work_order_num INTO v_work_order_num
        FROM jobs
        WHERE id = p_job_id;
        
        IF v_work_order_num IS NULL THEN
            RAISE EXCEPTION 'Job not found or missing work_order_num: %', p_job_id;
        END IF;
        
        -- STEP 2: Ensure Work Orders folder exists
        v_work_orders_folder_id := ensure_folder_exists(
            '/' || v_sanitized_property_name || '/Work Orders',
            v_property_folder_id,
            p_property_id,
            NULL
        );
        
        -- STEP 3: Ensure specific work order folder exists
        v_wo_folder_id := ensure_folder_exists(
            '/' || v_sanitized_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0'),
            v_work_orders_folder_id,
            p_property_id,
            p_job_id
        );
        
        -- STEP 4: Determine target folder based on type
        CASE p_folder_type
            WHEN 'before' THEN
                v_folder_name := 'Before Images';
            WHEN 'sprinkler' THEN
                v_folder_name := 'Sprinkler Images';
            WHEN 'other' THEN
                v_folder_name := 'Other Files';
            ELSE
                v_folder_name := 'Other Files';
        END CASE;
        
        v_target_folder_id := ensure_folder_exists(
            '/' || v_sanitized_property_name || '/Work Orders/WO-' || 
            LPAD(v_work_order_num::text, 6, '0') || '/' || v_folder_name,
            v_wo_folder_id,
            p_property_id,
            p_job_id
        );
        
        SELECT path INTO v_folder_path
        FROM files
        WHERE id = v_target_folder_id;
        
        RETURN v_folder_path;
    END IF;
    
    RAISE EXCEPTION 'Invalid folder type or missing job_id: %', p_folder_type;
END;
$$;

DO $$
BEGIN
    RAISE NOTICE 'Updated get_upload_folder() function';
END $$;

-- =============================================================================
-- PART 4: UPDATE create_work_order_folder_structure FUNCTION
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'STEP 5: UPDATING create_work_order_folder_structure()';
    RAISE NOTICE '===========================================';
END $$;

DROP FUNCTION IF EXISTS create_work_order_folder_structure(UUID, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION create_work_order_folder_structure(
    p_property_id UUID,
    p_property_name TEXT,
    p_work_order_num TEXT,
    p_job_id UUID
)
RETURNS TABLE (
    before_images_folder_id UUID,
    sprinkler_images_folder_id UUID,
    other_files_folder_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sanitized_property_name TEXT;
    v_property_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_wo_folder_id UUID;
    v_before_id UUID;
    v_sprinkler_id UUID;
    v_other_id UUID;
BEGIN
    -- Sanitize property name
    v_sanitized_property_name := regexp_replace(p_property_name, '[^a-zA-Z0-9\s-]', '', 'g');
    v_sanitized_property_name := regexp_replace(v_sanitized_property_name, '\s+', ' ', 'g');
    v_sanitized_property_name := trim(v_sanitized_property_name);
    
    -- Create folder hierarchy using safe function
    v_property_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name,
        NULL,
        p_property_id,
        NULL
    );
    
    v_work_orders_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders',
        v_property_folder_id,
        p_property_id,
        NULL
    );
    
    v_wo_folder_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders/WO-' || p_work_order_num,
        v_work_orders_folder_id,
        p_property_id,
        p_job_id
    );
    
    v_before_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders/WO-' || p_work_order_num || '/Before Images',
        v_wo_folder_id,
        p_property_id,
        p_job_id
    );
    
    v_sprinkler_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders/WO-' || p_work_order_num || '/Sprinkler Images',
        v_wo_folder_id,
        p_property_id,
        p_job_id
    );
    
    v_other_id := ensure_folder_exists(
        '/' || v_sanitized_property_name || '/Work Orders/WO-' || p_work_order_num || '/Other Files',
        v_wo_folder_id,
        p_property_id,
        p_job_id
    );
    
    RETURN QUERY SELECT v_before_id, v_sprinkler_id, v_other_id;
END;
$$;

DO $$
BEGIN
    RAISE NOTICE 'Updated create_work_order_folder_structure() function';
END $$;

-- =============================================================================
-- PART 5: GRANT PERMISSIONS
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'STEP 6: GRANTING PERMISSIONS';
    RAISE NOTICE '===========================================';
END $$;

GRANT EXECUTE ON FUNCTION ensure_folder_exists(TEXT, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_upload_folder(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_work_order_folder_structure(UUID, TEXT, TEXT, UUID) TO authenticated;

DO $$
BEGIN
    RAISE NOTICE 'Permissions granted to authenticated users';
END $$;

-- =============================================================================
-- PART 6: VERIFICATION
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'STEP 7: VERIFICATION';
    RAISE NOTICE '===========================================';
END $$;

DO $$
DECLARE
    v_function_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc
    WHERE proname IN ('ensure_folder_exists', 'get_upload_folder', 'create_work_order_folder_structure')
    AND pronamespace = 'public'::regnamespace;
    
    RAISE NOTICE 'Functions created: %/3', v_function_count;
    
    IF v_function_count = 3 THEN
        RAISE NOTICE 'SUCCESS: All functions created successfully!';
    ELSE
        RAISE WARNING 'WARNING: Not all functions were created!';
    END IF;
END $$;

-- =============================================================================
-- COMPLETION MESSAGE
-- =============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'FIX COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'What was fixed:';
    RAISE NOTICE '1. Cleaned up any duplicate folder paths';
    RAISE NOTICE '2. Created safe folder creation function (ensure_folder_exists)';
    RAISE NOTICE '3. Updated get_upload_folder to use safe creation';
    RAISE NOTICE '4. Updated create_work_order_folder_structure to use safe creation';
    RAISE NOTICE '5. Granted proper permissions';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Test image upload on work order form';
    RAISE NOTICE '2. Verify no duplicate key errors occur';
    RAISE NOTICE '3. Check that folders are created properly';
    RAISE NOTICE '';
    RAISE NOTICE 'The duplicate key error should now be resolved!';
    RAISE NOTICE '===========================================';
END $$;
