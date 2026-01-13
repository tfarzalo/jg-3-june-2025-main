BEGIN;

CREATE OR REPLACE FUNCTION public.create_file_record(
  p_name text,
  p_path text,
  p_size integer,
  p_type text,
  p_uploaded_by uuid,
  p_property_id uuid,
  p_job_id uuid,
  p_folder_id uuid,
  p_category text,
  p_context_type text DEFAULT 'work_order'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO files (
    name, path, size, type, uploaded_by, property_id, job_id, folder_id, category, context_type
  ) VALUES (
    p_name, p_path, p_size, p_type, p_uploaded_by, p_property_id, p_job_id, p_folder_id, NULLIF(p_category, ''), p_context_type
  )
  ON CONFLICT (path) DO UPDATE SET
    size = EXCLUDED.size,
    type = EXCLUDED.type,
    uploaded_by = EXCLUDED.uploaded_by,
    property_id = EXCLUDED.property_id,
    job_id = EXCLUDED.job_id,
    folder_id = EXCLUDED.folder_id,
    category = EXCLUDED.category,
    context_type = EXCLUDED.context_type
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_file_record(text, text, integer, text, uuid, uuid, uuid, uuid, text, text) TO authenticated;

COMMIT;
