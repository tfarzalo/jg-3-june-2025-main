-- Preserve historical job unit-size labels when the master Unit Size name is
-- renamed. Jobs keep their unit_size_id for billing/config relationships and
-- also keep the label that was true for that job at creation or intentional
-- job-level unit-size change time.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS unit_size_label_snapshot text;

COMMENT ON COLUMN public.jobs.unit_size_label_snapshot IS
'Historical display label for the job unit size. Prevents master unit size renames from changing old job details.';

UPDATE public.jobs j
SET unit_size_label_snapshot = us.unit_size_label
FROM public.unit_sizes us
WHERE j.unit_size_id = us.id
  AND NULLIF(btrim(COALESCE(j.unit_size_label_snapshot, '')), '') IS NULL;

CREATE OR REPLACE FUNCTION public.set_job_unit_size_label_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
BEGIN
  IF NEW.unit_size_id IS NULL THEN
    NEW.unit_size_label_snapshot := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     OR NEW.unit_size_id IS DISTINCT FROM OLD.unit_size_id
     OR NULLIF(btrim(COALESCE(NEW.unit_size_label_snapshot, '')), '') IS NULL THEN
    SELECT unit_size_label
    INTO v_label
    FROM public.unit_sizes
    WHERE id = NEW.unit_size_id;

    NEW.unit_size_label_snapshot := COALESCE(v_label, NEW.unit_size_label_snapshot);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_job_unit_size_label_snapshot ON public.jobs;
CREATE TRIGGER trigger_set_job_unit_size_label_snapshot
  BEFORE INSERT OR UPDATE OF unit_size_id, unit_size_label_snapshot
  ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_job_unit_size_label_snapshot();

CREATE OR REPLACE FUNCTION public.freeze_job_unit_size_labels_before_master_rename()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.unit_size_label IS DISTINCT FROM OLD.unit_size_label THEN
    UPDATE public.jobs
    SET unit_size_label_snapshot = OLD.unit_size_label
    WHERE unit_size_id = OLD.id
      AND NULLIF(btrim(COALESCE(unit_size_label_snapshot, '')), '') IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_freeze_job_unit_size_labels_before_master_rename ON public.unit_sizes;
CREATE TRIGGER trigger_freeze_job_unit_size_labels_before_master_rename
  BEFORE UPDATE OF unit_size_label
  ON public.unit_sizes
  FOR EACH ROW
  EXECUTE FUNCTION public.freeze_job_unit_size_labels_before_master_rename();

DROP FUNCTION IF EXISTS public.rename_unit_size(uuid, text);

CREATE OR REPLACE FUNCTION public.rename_unit_size(
  p_unit_size_id uuid,
  p_new_label text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trimmed_label text := btrim(p_new_label);
  v_current_label text;
BEGIN
  IF NOT public.can_manage_admin_settings() THEN
    RAISE EXCEPTION 'You do not have permission to rename unit sizes'
      USING ERRCODE = '42501';
  END IF;

  IF v_trimmed_label = '' THEN
    RAISE EXCEPTION 'Unit size label cannot be empty'
      USING ERRCODE = '22023';
  END IF;

  SELECT unit_size_label
  INTO v_current_label
  FROM public.unit_sizes
  WHERE id = p_unit_size_id;

  IF v_current_label IS NULL THEN
    RAISE EXCEPTION 'Unit size not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF lower(v_current_label) = lower(v_trimmed_label) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.unit_sizes
    WHERE id <> p_unit_size_id
      AND lower(unit_size_label) = lower(v_trimmed_label)
  ) THEN
    RAISE EXCEPTION 'A unit size with that label already exists'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.jobs
  SET unit_size_label_snapshot = v_current_label
  WHERE unit_size_id = p_unit_size_id
    AND NULLIF(btrim(COALESCE(unit_size_label_snapshot, '')), '') IS NULL;

  UPDATE public.unit_sizes
  SET unit_size_label = v_trimmed_label
  WHERE id = p_unit_size_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rename_unit_size(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_job_unit_size(
  p_job_id uuid,
  p_unit_size_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_unit_size_id uuid;
  v_old_unit_size_label text;
  v_new_unit_size_label text;
  v_actor_id uuid := auth.uid();
  v_actor_role text;
BEGIN
  SELECT
    j.unit_size_id,
    COALESCE(NULLIF(btrim(j.unit_size_label_snapshot), ''), old_size.unit_size_label),
    new_size.unit_size_label
  INTO v_old_unit_size_id, v_old_unit_size_label, v_new_unit_size_label
  FROM public.jobs j
  LEFT JOIN public.unit_sizes old_size ON old_size.id = j.unit_size_id
  LEFT JOIN public.unit_sizes new_size ON new_size.id = p_unit_size_id
  WHERE j.id = p_job_id;

  IF v_old_unit_size_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = p_job_id) THEN
    RETURN json_build_object('success', false, 'error', 'Job not found');
  END IF;

  IF v_new_unit_size_label IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Unit size not found');
  END IF;

  IF v_old_unit_size_id IS NOT DISTINCT FROM p_unit_size_id THEN
    RETURN json_build_object('success', true, 'changed', false);
  END IF;

  UPDATE public.jobs
  SET
    unit_size_id = p_unit_size_id,
    unit_size_label_snapshot = v_new_unit_size_label,
    updated_at = now()
  WHERE id = p_job_id;

  SELECT role
  INTO v_actor_role
  FROM public.profiles
  WHERE id = v_actor_id;

  IF v_actor_role = 'subcontractor' THEN
    INSERT INTO public.activity_log (entity_type, entity_id, action, description, changed_by, metadata)
    VALUES (
      'job',
      p_job_id,
      'updated',
      format(
        'Subcontractor changed unit size from %s to %s.',
        COALESCE(v_old_unit_size_label, 'Unassigned'),
        COALESCE(v_new_unit_size_label, 'Unassigned')
      ),
      v_actor_id,
      jsonb_build_object(
        'event_type', 'subcontractor_unit_size_changed',
        'title', 'Subcontractor changed unit size',
        'job_id', p_job_id,
        'old_unit_size_id', v_old_unit_size_id,
        'new_unit_size_id', p_unit_size_id,
        'old_unit_size_label', COALESCE(v_old_unit_size_label, 'Unassigned'),
        'new_unit_size_label', COALESCE(v_new_unit_size_label, 'Unassigned'),
        'changed_by_role', v_actor_role
      )
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'changed', true,
    'old_unit_size_label', COALESCE(v_old_unit_size_label, 'Unassigned'),
    'new_unit_size_label', COALESCE(v_new_unit_size_label, 'Unassigned')
  );
EXCEPTION
  WHEN others THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_job_unit_size(uuid, uuid) TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_job_details'
      AND oidvectortypes(p.proargtypes) = 'uuid'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_job_details_unit_size_snapshot_base'
      AND oidvectortypes(p.proargtypes) = 'uuid'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.get_job_details(uuid) RENAME TO get_job_details_unit_size_snapshot_base';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_job_details(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payload jsonb;
  v_unit_size_label_snapshot text;
BEGIN
  v_payload := public.get_job_details_unit_size_snapshot_base(p_job_id);

  IF v_payload IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT NULLIF(btrim(unit_size_label_snapshot), '')
  INTO v_unit_size_label_snapshot
  FROM public.jobs
  WHERE id = p_job_id;

  IF v_unit_size_label_snapshot IS NOT NULL THEN
    v_payload := jsonb_set(
      v_payload,
      '{unit_size,label}',
      to_jsonb(v_unit_size_label_snapshot),
      true
    );
  END IF;

  RETURN v_payload || jsonb_build_object(
    'unit_size_label_snapshot',
    v_unit_size_label_snapshot
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_job_details(uuid) TO authenticated;
