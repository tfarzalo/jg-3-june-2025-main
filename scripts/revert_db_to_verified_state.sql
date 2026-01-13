BEGIN;

DROP FUNCTION IF EXISTS ensure_folder_exists(text) CASCADE;
DROP FUNCTION IF EXISTS ensure_folder_exists(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS ensure_folder_exists(text, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS ensure_folder_exists(text, uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS ensure_folder_exists(text, uuid, uuid, uuid, text) CASCADE;

UPDATE files 
SET type = 'folder/directory' 
WHERE type IN ('folder/property', 'folder/job');

DO $$
DECLARE
    v_properties_root_id UUID;
BEGIN
    SELECT id INTO v_properties_root_id FROM files WHERE path = '/Properties';
    IF v_properties_root_id IS NOT NULL THEN
        UPDATE files
        SET folder_id = v_properties_root_id
        WHERE folder_id IS NULL 
        AND path LIKE '/Properties/%'
        AND path NOT LIKE '/Properties/%/%'
        AND id != v_properties_root_id;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION ensure_folder_exists(
    p_path TEXT,
    p_parent_folder_id UUID DEFAULT NULL,
    p_property_id UUID DEFAULT NULL,
    p_job_id UUID DEFAULT NULL,
    p_folder_type TEXT DEFAULT 'folder/directory'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_folder_id UUID;
    v_folder_name TEXT;
    v_user_id UUID;
BEGIN
    v_folder_name := regexp_replace(p_path, '^.*/', '');
    SELECT COALESCE(auth.uid(), (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)) INTO v_user_id;
    SELECT id INTO v_folder_id
    FROM files
    WHERE path = p_path
    AND type = 'folder/directory'
    LIMIT 1;
    IF v_folder_id IS NULL THEN
        BEGIN
            INSERT INTO files (
                name, path, type, folder_id, property_id, job_id, uploaded_by, size
            )
            VALUES (
                v_folder_name, p_path, 'folder/directory', p_parent_folder_id,
                p_property_id, p_job_id, v_user_id, 0
            )
            ON CONFLICT (path) DO UPDATE
            SET 
                folder_id = EXCLUDED.folder_id,
                type = 'folder/directory'
            RETURNING id INTO v_folder_id;
        EXCEPTION WHEN unique_violation THEN
            SELECT id INTO v_folder_id
            FROM files
            WHERE path = p_path AND type = 'folder/directory'
            LIMIT 1;
        END;
    ELSE
        IF p_parent_folder_id IS NOT NULL THEN
            UPDATE files 
            SET folder_id = p_parent_folder_id 
            WHERE id = v_folder_id AND folder_id IS NULL;
        END IF;
    END IF;
    RETURN v_folder_id;
END;
$$;

CREATE OR REPLACE FUNCTION create_property_folder()
RETURNS TRIGGER AS $$
DECLARE
    v_properties_root_id UUID;
    v_property_folder_id UUID;
BEGIN
    v_properties_root_id := public.ensure_folder_exists('/Properties'::text, NULL::uuid, NULL::uuid, NULL::uuid);
    v_property_folder_id := public.ensure_folder_exists(
        '/Properties/' || NEW.property_name,
        v_properties_root_id,
        NEW.id,
        NULL::uuid
    );
    PERFORM public.ensure_folder_exists(
        '/Properties/' || NEW.property_name || '/Work Orders',
        v_property_folder_id,
        NEW.id,
        NULL::uuid
    );
    PERFORM public.ensure_folder_exists(
        '/Properties/' || NEW.property_name || '/Property Files',
        v_property_folder_id,
        NEW.id,
        NULL::uuid
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_job_folder()
RETURNS TRIGGER AS $$
DECLARE
    v_property_name TEXT;
    v_properties_root_id UUID;
    v_property_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_job_folder_id UUID;
    v_work_order_num TEXT;
BEGIN
    SELECT property_name INTO v_property_name FROM properties WHERE id = NEW.property_id;
    IF v_property_name IS NULL THEN RETURN NEW; END IF;
    v_properties_root_id := public.ensure_folder_exists('/Properties'::text, NULL::uuid, NULL::uuid, NULL::uuid);
    v_property_folder_id := public.ensure_folder_exists(
        '/Properties/' || v_property_name,
        v_properties_root_id,
        NEW.property_id,
        NULL::uuid
    );
    v_work_orders_folder_id := public.ensure_folder_exists(
        '/Properties/' || v_property_name || '/Work Orders',
        v_property_folder_id,
        NEW.property_id,
        NULL::uuid
    );
    v_work_order_num := 'WO-' || LPAD(NEW.work_order_num::text, 6, '0');
    v_job_folder_id := public.ensure_folder_exists(
        '/Properties/' || v_property_name || '/Work Orders/' || v_work_order_num,
        v_work_orders_folder_id,
        NEW.property_id,
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_upload_folder(
    p_property_id UUID,
    p_job_id UUID,
    p_folder_type TEXT
)
RETURNS UUID 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_property_name TEXT;
    v_work_order_num INTEGER;
    v_properties_root_id UUID;
    v_property_folder_id UUID;
    v_work_orders_folder_id UUID;
    v_wo_folder_id UUID;
    v_folder_name TEXT;
BEGIN
    SELECT property_name INTO v_property_name
    FROM properties WHERE id = p_property_id;
    v_properties_root_id := public.ensure_folder_exists('/Properties'::text, NULL::uuid, NULL::uuid, NULL::uuid);
    v_property_folder_id := public.ensure_folder_exists(
        '/Properties/' || v_property_name, 
        v_properties_root_id, 
        p_property_id,
        NULL::uuid
    );
    IF p_folder_type = 'property_files' THEN
        RETURN public.ensure_folder_exists(
            '/Properties/' || v_property_name || '/Property Files',
            v_property_folder_id, 
            p_property_id,
            NULL::uuid
        );
    END IF;
    IF p_job_id IS NOT NULL THEN
        SELECT work_order_num INTO v_work_order_num FROM jobs WHERE id = p_job_id;
        v_work_orders_folder_id := public.ensure_folder_exists(
            '/Properties/' || v_property_name || '/Work Orders',
            v_property_folder_id, 
            p_property_id,
            NULL::uuid
        );
        v_wo_folder_id := public.ensure_folder_exists(
            '/Properties/' || v_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0'),
            v_work_orders_folder_id, 
            p_property_id, 
            p_job_id
        );
        v_folder_name := CASE p_folder_type
            WHEN 'before' THEN 'Before Images'
            WHEN 'after' THEN 'After Images'
            WHEN 'sprinkler' THEN 'Sprinkler Images'
            WHEN 'job_files' THEN 'Job Files'
            ELSE 'Other Files'
        END;
        RETURN public.ensure_folder_exists(
            '/Properties/' || v_property_name || '/Work Orders/WO-' || LPAD(v_work_order_num::text, 6, '0') || '/' || v_folder_name,
            v_wo_folder_id, 
            p_property_id, 
            p_job_id
        );
    END IF;
    RAISE EXCEPTION 'Invalid parameters for get_upload_folder';
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_folder_exists(text, uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_upload_folder(uuid, uuid, text) TO authenticated;

COMMIT;
