BEGIN;

DROP TRIGGER IF EXISTS trigger_create_property_folder ON properties;
DROP TRIGGER IF EXISTS create_property_folder_trigger ON properties;
DROP TRIGGER IF EXISTS create_job_folder_trigger ON jobs;

CREATE TRIGGER create_property_folder_trigger
AFTER INSERT ON properties
FOR EACH ROW
EXECUTE FUNCTION create_property_folder();

CREATE TRIGGER create_job_folder_trigger
AFTER INSERT ON jobs
FOR EACH ROW
EXECUTE FUNCTION create_job_folder();

UPDATE files
SET type = 'folder/directory'
WHERE name LIKE 'WO-%'
AND type = 'folder/job';

DO $$
DECLARE
  v_prop RECORD;
  v_properties_root UUID;
  v_prop_folder UUID;
  v_work_orders_folder UUID;
  v_wo RECORD;
  v_target_path TEXT;
  v_existing_id UUID;
BEGIN
  v_properties_root := public.ensure_folder_exists('/Properties'::text, NULL::uuid, NULL::uuid, NULL::uuid);
  FOR v_prop IN SELECT id, property_name FROM properties LOOP
    v_prop_folder := public.ensure_folder_exists('/Properties/' || v_prop.property_name, v_properties_root, v_prop.id, NULL::uuid);
    v_work_orders_folder := public.ensure_folder_exists('/Properties/' || v_prop.property_name || '/Work Orders', v_prop_folder, v_prop.id, NULL::uuid);
    FOR v_wo IN
      SELECT id, name, path, type
      FROM files
      WHERE property_id = v_prop.id
        AND name LIKE 'WO-%'
        AND path NOT LIKE '/Properties/%/Work Orders/%'
    LOOP
      v_target_path := '/Properties/' || v_prop.property_name || '/Work Orders/' || v_wo.name;
      SELECT id INTO v_existing_id FROM files WHERE path = v_target_path LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
        -- Reparent any children of the duplicate folder to the existing canonical folder
        UPDATE files SET folder_id = v_existing_id WHERE folder_id = v_wo.id;
        -- Remove the duplicate folder row to resolve the unique path conflict
        DELETE FROM files WHERE id = v_wo.id AND type IN ('folder/directory', 'folder/job');
      ELSE
        -- Move the folder into the canonical location
        UPDATE files
        SET path = v_target_path,
            folder_id = v_work_orders_folder,
            type = 'folder/directory'
        WHERE id = v_wo.id;
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
