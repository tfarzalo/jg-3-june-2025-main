-- ==============================================================================
-- FINAL FIX: PREVENT ROOT FOLDER CREATION (GUARD ONLY)
-- ==============================================================================
-- This script installs a "Guard Trigger" that intercepts any attempt to create 
-- a property folder at the root level and forces it into /Properties.
-- It does NOT attempt to move existing files, avoiding "duplicate key" errors.

BEGIN;

-- 1. Create the Guard Function
-- ==============================================================================
CREATE OR REPLACE FUNCTION guard_root_folders()
RETURNS TRIGGER AS $$
DECLARE
    v_properties_root_id UUID;
BEGIN
    -- Only check if inserting at Root (folder_id IS NULL)
    -- And it's NOT the 'Properties' folder itself
    IF NEW.folder_id IS NULL AND NEW.name != 'Properties' AND NEW.type LIKE 'folder/%' THEN
        
        -- Check if this matches a Property Name
        PERFORM 1 FROM properties WHERE property_name = NEW.name;
        
        IF FOUND THEN
            -- It matches a Property! Re-route to /Properties
            
            -- Get /Properties ID (Create if missing)
            SELECT id INTO v_properties_root_id FROM files WHERE path = '/Properties';
            
            IF v_properties_root_id IS NULL THEN
                INSERT INTO files (name, path, type, size)
                VALUES ('Properties', '/Properties', 'folder/directory', 0)
                RETURNING id INTO v_properties_root_id;
            END IF;
            
            -- Re-route the new folder
            NEW.folder_id := v_properties_root_id;
            NEW.path := '/Properties/' || NEW.name;
            NEW.type := 'folder/directory'; -- Enforce correct type
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach the Trigger
-- ==============================================================================
DROP TRIGGER IF EXISTS guard_root_folders_trigger ON files;

CREATE TRIGGER guard_root_folders_trigger
BEFORE INSERT ON files
FOR EACH ROW
EXECUTE FUNCTION guard_root_folders();

COMMIT;
