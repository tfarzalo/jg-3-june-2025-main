-- ============================================================================
-- MIGRATION: Property Folder Management & File Upload Fix
-- ============================================================================
-- Date: November 11, 2025
-- Purpose: Ensure property folders exist before file uploads and add rename functionality
-- ============================================================================

-- Part 1: Ensure Property Folders Exist Function
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_property_folders_exist(
    p_property_id UUID,
    p_property_name TEXT
)
RETURNS TABLE(
    property_folder_id UUID,
    work_orders_folder_id UUID,
    property_files_folder_id UUID,
    folders_existed BOOLEAN,
    folders_created BOOLEAN
) AS $$
DECLARE
    v_property_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_property_files_folder_id UUID;
    v_folders_existed BOOLEAN := FALSE;
    v_folders_created BOOLEAN := FALSE;
BEGIN
    -- Check if folders already exist
    SELECT 
        pf.id, wof.id, pff.id
    INTO 
        v_property_folder_id, v_work_orders_folder_id, v_property_files_folder_id
    FROM files pf
    LEFT JOIN files wof ON wof.folder_id = pf.id 
        AND wof.name = 'Work Orders' 
        AND wof.type = 'folder/directory'
    LEFT JOIN files pff ON pff.folder_id = pf.id 
        AND pff.name = 'Property Files' 
        AND pff.type = 'folder/directory'
    WHERE pf.property_id = p_property_id
        AND pf.folder_id IS NULL
        AND pf.type = 'folder/directory'
    LIMIT 1;
    
    -- If all folders exist, return them
    IF v_property_folder_id IS NOT NULL 
       AND v_work_orders_folder_id IS NOT NULL 
       AND v_property_files_folder_id IS NOT NULL THEN
        v_folders_existed := TRUE;
        RAISE NOTICE 'Property folders already exist for: %', p_property_name;
    ELSE
        -- Folders don't exist or are incomplete, create them
        RAISE NOTICE 'Creating property folder structure for: %', p_property_name;
        
        SELECT 
            cps.property_folder_id, cps.work_orders_folder_id, cps.property_files_folder_id
        INTO 
            v_property_folder_id, v_work_orders_folder_id, v_property_files_folder_id
        FROM create_property_folder_structure(p_property_id, p_property_name) AS cps;
        
        v_folders_created := TRUE;
        RAISE NOTICE 'Property folders created successfully';
    END IF;
    
    RETURN QUERY SELECT 
        v_property_folder_id,
        v_work_orders_folder_id,
        v_property_files_folder_id,
        v_folders_existed,
        v_folders_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION ensure_property_folders_exist(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_property_folders_exist(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION ensure_property_folders_exist IS 'Ensures property folder structure exists, creates if missing. Safe to call multiple times.';

-- Part 2: Prepare Property for File Upload Function
-- ============================================================================

CREATE OR REPLACE FUNCTION prepare_property_for_file_upload(
    p_property_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_property_name TEXT;
    v_result RECORD;
BEGIN
    -- Get property name
    SELECT property_name INTO v_property_name
    FROM properties
    WHERE id = p_property_id;
    
    IF v_property_name IS NULL THEN
        RAISE EXCEPTION 'Property not found: %', p_property_id;
    END IF;
    
    -- Ensure folders exist
    SELECT * INTO v_result
    FROM ensure_property_folders_exist(p_property_id, v_property_name);
    
    -- Return folder information
    RETURN json_build_object(
        'success', TRUE,
        'property_folder_id', v_result.property_folder_id,
        'work_orders_folder_id', v_result.work_orders_folder_id,
        'property_files_folder_id', v_result.property_files_folder_id,
        'folders_existed', v_result.folders_existed,
        'folders_created', v_result.folders_created,
        'message', CASE 
            WHEN v_result.folders_created THEN 'Folders created successfully'
            ELSE 'Folders already exist'
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION prepare_property_for_file_upload(UUID) TO authenticated;

COMMENT ON FUNCTION prepare_property_for_file_upload IS 'Prepares property for file upload by ensuring folder structure exists. Call this before uploading files.';

-- Part 3: Property Creation Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_create_property_folders()
RETURNS TRIGGER AS $$
BEGIN
    -- Create property folder structure immediately after property creation
    PERFORM ensure_property_folders_exist(NEW.id, NEW.property_name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS property_create_folders_trigger ON properties;

-- Create new trigger
CREATE TRIGGER property_create_folders_trigger
AFTER INSERT ON properties
FOR EACH ROW
EXECUTE FUNCTION trigger_create_property_folders();

COMMENT ON TRIGGER property_create_folders_trigger ON properties IS 'Automatically creates folder structure when a property is created';

-- Part 4: Add display_path and storage_path columns if they don't exist
-- ============================================================================

DO $$
BEGIN
    -- Add display_path column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'files' AND column_name = 'display_path'
    ) THEN
        ALTER TABLE files ADD COLUMN display_path TEXT;
        COMMENT ON COLUMN files.display_path IS 'User-friendly path with spaces for display';
    END IF;

    -- Add storage_path column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'files' AND column_name = 'storage_path'
    ) THEN
        ALTER TABLE files ADD COLUMN storage_path TEXT;
        COMMENT ON COLUMN files.storage_path IS 'Sanitized path with underscores for storage';
    END IF;
END $$;

-- Part 5: Backfill display_path and storage_path for existing files
-- ============================================================================

UPDATE files
SET 
    display_path = COALESCE(display_path, path),
    storage_path = COALESCE(storage_path, path)
WHERE display_path IS NULL OR storage_path IS NULL;

-- Part 6: Create Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_files_property_folder_type 
ON files(property_id, folder_id, type);

CREATE INDEX IF NOT EXISTS idx_files_folder_id 
ON files(folder_id) WHERE folder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_files_property_type 
ON files(property_id, type) WHERE property_id IS NOT NULL;

-- Part 7: Fix existing properties without folder structures
-- ============================================================================

DO $$
DECLARE
    v_property RECORD;
    v_fixed_count INTEGER := 0;
    v_skipped_count INTEGER := 0;
BEGIN
    RAISE NOTICE 'Checking existing properties for missing folder structures...';
    
    FOR v_property IN 
        SELECT p.id, p.property_name
        FROM properties p
        WHERE NOT EXISTS (
            SELECT 1 FROM files f
            WHERE f.property_id = p.id
              AND f.type = 'folder/directory'
              AND f.folder_id IS NULL
        )
    LOOP
        RAISE NOTICE 'Creating folders for property: % (ID: %)', v_property.property_name, v_property.id;
        
        PERFORM ensure_property_folders_exist(v_property.id, v_property.property_name);
        v_fixed_count := v_fixed_count + 1;
    END LOOP;
    
    -- Count properties that already have folders
    SELECT COUNT(*) INTO v_skipped_count
    FROM properties p
    WHERE EXISTS (
        SELECT 1 FROM files f
        WHERE f.property_id = p.id
          AND f.type = 'folder/directory'
          AND f.folder_id IS NULL
    );
    
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Folder structure check complete!';
    RAISE NOTICE 'Properties with folders created: %', v_fixed_count;
    RAISE NOTICE 'Properties that already had folders: %', v_skipped_count;
    RAISE NOTICE '===========================================';
END $$;

-- Part 8: Verification Queries
-- ============================================================================

-- Check for properties without complete folder structures
DO $$
DECLARE
    v_missing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_missing_count
    FROM properties p
    LEFT JOIN files f ON f.property_id = p.id AND f.type = 'folder/directory'
    GROUP BY p.id, p.property_name
    HAVING 
        COUNT(DISTINCT CASE WHEN f.name = 'Work Orders' THEN f.id END) = 0
        OR COUNT(DISTINCT CASE WHEN f.name = 'Property Files' THEN f.id END) = 0;
    
    IF v_missing_count > 0 THEN
        RAISE WARNING 'Found % properties with missing folder structures', v_missing_count;
    ELSE
        RAISE NOTICE 'All properties have complete folder structures!';
    END IF;
END $$;
