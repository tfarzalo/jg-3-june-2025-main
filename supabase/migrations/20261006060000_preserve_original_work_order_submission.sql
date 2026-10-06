-- Preserve the first subcontractor work-order submission without modifying any
-- existing work order or attachment. Existing rows intentionally receive no
-- fabricated/backfilled snapshot.

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS removed_from_current_work_order_at timestamptz;

CREATE TABLE IF NOT EXISTS public.work_order_original_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL UNIQUE REFERENCES public.work_orders(id) ON DELETE RESTRICT,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  snapshot_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_order_original_submissions_job_id
  ON public.work_order_original_submissions(job_id);

CREATE TABLE IF NOT EXISTS public.work_order_original_submission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_submission_id uuid NOT NULL
    REFERENCES public.work_order_original_submissions(id) ON DELETE RESTRICT,
  file_id uuid REFERENCES public.files(id) ON DELETE SET NULL,
  bucket text NOT NULL DEFAULT 'files',
  storage_path text NOT NULL,
  category text,
  file_name text NOT NULL,
  original_filename text,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (original_submission_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_original_submission_files_submission
  ON public.work_order_original_submission_files(original_submission_id);
CREATE INDEX IF NOT EXISTS idx_original_submission_files_file
  ON public.work_order_original_submission_files(file_id);

ALTER TABLE public.work_order_original_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_order_original_submission_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Internal users can read original work order submissions"
  ON public.work_order_original_submissions;
CREATE POLICY "Internal users can read original work order submissions"
  ON public.work_order_original_submissions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IS DISTINCT FROM 'subcontractor'
    )
  );

DROP POLICY IF EXISTS "Internal users can read original work order submission files"
  ON public.work_order_original_submission_files;
CREATE POLICY "Internal users can read original work order submission files"
  ON public.work_order_original_submission_files FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IS DISTINCT FROM 'subcontractor'
    )
  );

CREATE OR REPLACE FUNCTION public.reject_original_submission_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Original subcontractor submissions are immutable';
END;
$$;

DROP TRIGGER IF EXISTS protect_original_work_order_submissions
  ON public.work_order_original_submissions;
CREATE TRIGGER protect_original_work_order_submissions
  BEFORE UPDATE OR DELETE ON public.work_order_original_submissions
  FOR EACH ROW EXECUTE FUNCTION public.reject_original_submission_mutation();

DROP TRIGGER IF EXISTS protect_original_work_order_submission_files
  ON public.work_order_original_submission_files;
CREATE TRIGGER protect_original_work_order_submission_files
  BEFORE UPDATE OR DELETE ON public.work_order_original_submission_files
  FOR EACH ROW EXECUTE FUNCTION public.reject_original_submission_mutation();

CREATE OR REPLACE FUNCTION public.protect_original_submission_file_object()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.work_order_original_submission_files sf
    WHERE sf.file_id = OLD.id
       OR sf.storage_path = COALESCE(NULLIF(OLD.storage_path, ''), OLD.path)
  ) THEN
    RAISE EXCEPTION 'This file is preserved by an original subcontractor submission';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS protect_original_submission_file_before_delete ON public.files;
CREATE TRIGGER protect_original_submission_file_before_delete
  BEFORE DELETE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.protect_original_submission_file_object();

CREATE OR REPLACE FUNCTION public.capture_original_work_order_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role text;
  v_snapshot_id uuid;
  v_context jsonb;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = NEW.prepared_by;

  -- Administrative creation/editing and preview flows are not subcontractor
  -- submissions and must not create misleading historical records.
  IF v_role IS DISTINCT FROM 'subcontractor' THEN
    RETURN NEW;
  END IF;

  SELECT jsonb_build_object(
    'job_id', j.id,
    'work_order_num', j.work_order_num,
    'scheduled_date', j.scheduled_date,
    'property_id', p.id,
    'property_name', p.property_name,
    'property_address', p.address,
    'property_city', p.city,
    'property_state', p.state,
    'unit_size_id', j.unit_size_id,
    'job_category_id', j.job_category_id
  )
  INTO v_context
  FROM public.jobs j
  LEFT JOIN public.properties p ON p.id = j.property_id
  WHERE j.id = NEW.job_id;

  INSERT INTO public.work_order_original_submissions (
    work_order_id, job_id, submitted_by, submitted_at, schema_version, snapshot_payload
  ) VALUES (
    NEW.id,
    NEW.job_id,
    NEW.prepared_by,
    COALESCE(NEW.submission_date::timestamptz, now()),
    1,
    jsonb_build_object(
      'work_order', to_jsonb(NEW),
      'job_context', COALESCE(v_context, '{}'::jsonb)
    )
  )
  ON CONFLICT (work_order_id) DO NOTHING
  RETURNING id INTO v_snapshot_id;

  IF v_snapshot_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.work_order_original_submission_files (
    original_submission_id, file_id, bucket, storage_path, category,
    file_name, original_filename, mime_type, uploaded_by, uploaded_at
  )
  SELECT
    v_snapshot_id,
    f.id,
    COALESCE(NULLIF(f.bucket, ''), 'files'),
    COALESCE(NULLIF(f.storage_path, ''), f.path),
    f.category,
    f.name,
    f.original_filename,
    f.type,
    f.uploaded_by,
    f.created_at
  FROM public.files f
  WHERE f.job_id = NEW.job_id
    AND f.uploaded_by = NEW.prepared_by
    AND f.type <> 'folder/directory'
    AND f.removed_from_current_work_order_at IS NULL
    AND COALESCE(NULLIF(f.storage_path, ''), f.path) IS NOT NULL
    AND f.created_at <= now()
  ON CONFLICT (original_submission_id, storage_path) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_original_work_order_submission_after_insert
  ON public.work_orders;
CREATE TRIGGER capture_original_work_order_submission_after_insert
  AFTER INSERT ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.capture_original_work_order_submission();

REVOKE ALL ON FUNCTION public.capture_original_work_order_submission() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_original_submission_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_original_submission_file_object() FROM PUBLIC;
