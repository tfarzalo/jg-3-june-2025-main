-- ==============================================================================
-- FINAL GUARD: PREVENT ROOT FOLDER CREATION & CLEANUP
-- ==============================================================================

BEGIN;

-- 1. CLEANUP: Merge Root Folders into /Properties
-- ==============================================================================
DO $$
DECLARE
    r RECORD;
    v_properties_root_id UUID;
    v_dest_folder_id UUID;
BEGIN
    -- Get /Properties ID
    SELECT id INTO v_properties_root_id FROM files WHERE path = '/Properties';
    
    IF v_properties_root_id IS NOT NULL THEN
        -- Loop through Root folders that match a Property Name
        FOR r IN 
            SELECT f.id, f.name 
            FROM files f
            JOIN properties p ON f.name = p.property_name
            WHERE f.folder_id IS NULL 
            AND f.path != '/Properties' -- Don't move Properties itself
            AND f.type LIKE 'folder/%'
        LOOP
            -- Check if destination exists in /Properties
            SELECT id INTO v_dest_folder_id 
            FROM files 
            WHERE folder_id = v_properties_root_id 
            AND name = r.name;
            
            IF v_dest_folder_id IS NOT NULL THEN
                -- Destination exists: Move contents there
                UPDATE files 
                SET folder_id = v_dest_folder_id,
                    path = replace(path, '/' || r.name || '/', '/Properties/' || r.name || '/')
                WHERE folder_id = r.id;
                
                -- Delete the empty root folder
                DELETE FROM files WHERE id = r.id;
            ELSE
                -- Destination doesn't exist: Move the folder itself
                UPDATE files 
                SET folder_id = v_properties_root_id,
                    path = '/Properties/' || name
                WHERE id = r.id;
            END IF;
        END LOOP;
    END IF;
END $$;


-- 2. GUARD TRIGGER: Intercept Root Creations
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

-- Drop existing if any
DROP TRIGGER IF EXISTS guard_root_folders_trigger ON files;

-- Attach Trigger
CREATE TRIGGER guard_root_folders_trigger
BEFORE INSERT ON files
FOR EACH ROW
EXECUTE FUNCTION guard_root_folders();

COMMIT;
