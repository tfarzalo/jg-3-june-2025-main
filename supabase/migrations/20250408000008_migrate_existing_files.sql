-- Migrate existing files to new folder structure
CREATE OR REPLACE FUNCTION migrate_existing_files()
RETURNS void AS $$
DECLARE
    v_file RECORD;
    v_new_path text;
    v_property_name text;
    v_work_order_num text;
BEGIN
    -- Get all files that need to be migrated
    FOR v_file IN 
        SELECT 
            f.*,
            j.work_order_num,
            p.property_name
        FROM files f
        JOIN jobs j ON j.id = f.job_id
        JOIN properties p ON p.id = j.property_id
        WHERE f.type != 'folder/directory'
        AND f.path NOT LIKE '/Work Orders/%'
    LOOP
        -- Construct new path
        v_work_order_num := 'WO-' || LPAD(v_file.work_order_num::text, 6, '0');
        v_property_name := v_file.property_name;
        
        -- Determine folder type based on current path
        IF v_file.path LIKE '%sprinkler%' THEN
            v_new_path := '/Work Orders/' || v_property_name || '/' || v_work_order_num || '/Sprinkler Images/' || v_file.name;
        ELSIF v_file.path LIKE '%before%' THEN
            v_new_path := '/Work Orders/' || v_property_name || '/' || v_work_order_num || '/Before Images/' || v_file.name;
        ELSE
            v_new_path := '/Work Orders/' || v_property_name || '/' || v_work_order_num || '/Other Files/' || v_file.name;
        END IF;

        -- Move file in storage
        UPDATE storage.objects
        SET name = v_new_path
        WHERE name = v_file.path;

        -- Update file record
        UPDATE files
        SET path = v_new_path
        WHERE id = v_file.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute migration
SELECT migrate_existing_files();

-- Drop migration function
DROP FUNCTION migrate_existing_files(); 