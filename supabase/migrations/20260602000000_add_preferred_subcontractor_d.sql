-- Add a fourth preferred subcontractor slot to properties.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_d_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_d_name_snapshot text,
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_d_email_snapshot text,
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_d_deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_properties_preferred_subcontractor_d_id
  ON public.properties(preferred_subcontractor_d_id);

CREATE OR REPLACE FUNCTION public.sync_property_preferred_subcontractor_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_profile record;
BEGIN
  IF NEW.preferred_subcontractor_a_id IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND NEW.preferred_subcontractor_a_id IS DISTINCT FROM OLD.preferred_subcontractor_a_id)
     ) THEN
    SELECT full_name, email INTO v_profile FROM public.profiles WHERE id = NEW.preferred_subcontractor_a_id;
    NEW.preferred_subcontractor_a_name_snapshot := COALESCE(v_profile.full_name, v_profile.email);
    NEW.preferred_subcontractor_a_email_snapshot := v_profile.email;
    NEW.preferred_subcontractor_a_deleted_at := NULL;
  ELSIF NEW.preferred_subcontractor_a_id IS NULL
        AND TG_OP = 'UPDATE'
        AND OLD.preferred_subcontractor_a_id IS NOT NULL
        AND NEW.preferred_subcontractor_a_deleted_at IS NULL THEN
    NEW.preferred_subcontractor_a_name_snapshot := NULL;
    NEW.preferred_subcontractor_a_email_snapshot := NULL;
  END IF;

  IF NEW.preferred_subcontractor_b_id IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND NEW.preferred_subcontractor_b_id IS DISTINCT FROM OLD.preferred_subcontractor_b_id)
     ) THEN
    SELECT full_name, email INTO v_profile FROM public.profiles WHERE id = NEW.preferred_subcontractor_b_id;
    NEW.preferred_subcontractor_b_name_snapshot := COALESCE(v_profile.full_name, v_profile.email);
    NEW.preferred_subcontractor_b_email_snapshot := v_profile.email;
    NEW.preferred_subcontractor_b_deleted_at := NULL;
  ELSIF NEW.preferred_subcontractor_b_id IS NULL
        AND TG_OP = 'UPDATE'
        AND OLD.preferred_subcontractor_b_id IS NOT NULL
        AND NEW.preferred_subcontractor_b_deleted_at IS NULL THEN
    NEW.preferred_subcontractor_b_name_snapshot := NULL;
    NEW.preferred_subcontractor_b_email_snapshot := NULL;
  END IF;

  IF NEW.preferred_subcontractor_c_id IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND NEW.preferred_subcontractor_c_id IS DISTINCT FROM OLD.preferred_subcontractor_c_id)
     ) THEN
    SELECT full_name, email INTO v_profile FROM public.profiles WHERE id = NEW.preferred_subcontractor_c_id;
    NEW.preferred_subcontractor_c_name_snapshot := COALESCE(v_profile.full_name, v_profile.email);
    NEW.preferred_subcontractor_c_email_snapshot := v_profile.email;
    NEW.preferred_subcontractor_c_deleted_at := NULL;
  ELSIF NEW.preferred_subcontractor_c_id IS NULL
        AND TG_OP = 'UPDATE'
        AND OLD.preferred_subcontractor_c_id IS NOT NULL
        AND NEW.preferred_subcontractor_c_deleted_at IS NULL THEN
    NEW.preferred_subcontractor_c_name_snapshot := NULL;
    NEW.preferred_subcontractor_c_email_snapshot := NULL;
  END IF;

  IF NEW.preferred_subcontractor_d_id IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND NEW.preferred_subcontractor_d_id IS DISTINCT FROM OLD.preferred_subcontractor_d_id)
     ) THEN
    SELECT full_name, email INTO v_profile FROM public.profiles WHERE id = NEW.preferred_subcontractor_d_id;
    NEW.preferred_subcontractor_d_name_snapshot := COALESCE(v_profile.full_name, v_profile.email);
    NEW.preferred_subcontractor_d_email_snapshot := v_profile.email;
    NEW.preferred_subcontractor_d_deleted_at := NULL;
  ELSIF NEW.preferred_subcontractor_d_id IS NULL
        AND TG_OP = 'UPDATE'
        AND OLD.preferred_subcontractor_d_id IS NOT NULL
        AND NEW.preferred_subcontractor_d_deleted_at IS NULL THEN
    NEW.preferred_subcontractor_d_name_snapshot := NULL;
    NEW.preferred_subcontractor_d_email_snapshot := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_property_preferred_subcontractor_snapshot ON public.properties;

CREATE TRIGGER trigger_sync_property_preferred_subcontractor_snapshot
BEFORE INSERT OR UPDATE OF
  preferred_subcontractor_a_id,
  preferred_subcontractor_b_id,
  preferred_subcontractor_c_id,
  preferred_subcontractor_d_id,
  preferred_subcontractor_a_deleted_at,
  preferred_subcontractor_b_deleted_at,
  preferred_subcontractor_c_deleted_at,
  preferred_subcontractor_d_deleted_at
ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.sync_property_preferred_subcontractor_snapshot();

CREATE OR REPLACE FUNCTION public.preserve_profile_delete_history()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_deleted_at timestamptz := now();
  v_name text := COALESCE(OLD.full_name, OLD.email, 'Deleted user');
BEGIN
  UPDATE public.jobs
  SET assigned_to_name_snapshot = COALESCE(assigned_to_name_snapshot, v_name),
      assigned_to_email_snapshot = COALESCE(assigned_to_email_snapshot, OLD.email),
      assigned_to_deleted_at = COALESCE(assigned_to_deleted_at, v_deleted_at),
      assigned_to = NULL
  WHERE assigned_to = OLD.id;

  UPDATE public.properties
  SET preferred_subcontractor_a_name_snapshot = COALESCE(preferred_subcontractor_a_name_snapshot, v_name),
      preferred_subcontractor_a_email_snapshot = COALESCE(preferred_subcontractor_a_email_snapshot, OLD.email),
      preferred_subcontractor_a_deleted_at = COALESCE(preferred_subcontractor_a_deleted_at, v_deleted_at),
      preferred_subcontractor_a_id = NULL
  WHERE preferred_subcontractor_a_id = OLD.id;

  UPDATE public.properties
  SET preferred_subcontractor_b_name_snapshot = COALESCE(preferred_subcontractor_b_name_snapshot, v_name),
      preferred_subcontractor_b_email_snapshot = COALESCE(preferred_subcontractor_b_email_snapshot, OLD.email),
      preferred_subcontractor_b_deleted_at = COALESCE(preferred_subcontractor_b_deleted_at, v_deleted_at),
      preferred_subcontractor_b_id = NULL
  WHERE preferred_subcontractor_b_id = OLD.id;

  UPDATE public.properties
  SET preferred_subcontractor_c_name_snapshot = COALESCE(preferred_subcontractor_c_name_snapshot, v_name),
      preferred_subcontractor_c_email_snapshot = COALESCE(preferred_subcontractor_c_email_snapshot, OLD.email),
      preferred_subcontractor_c_deleted_at = COALESCE(preferred_subcontractor_c_deleted_at, v_deleted_at),
      preferred_subcontractor_c_id = NULL
  WHERE preferred_subcontractor_c_id = OLD.id;

  UPDATE public.properties
  SET preferred_subcontractor_d_name_snapshot = COALESCE(preferred_subcontractor_d_name_snapshot, v_name),
      preferred_subcontractor_d_email_snapshot = COALESCE(preferred_subcontractor_d_email_snapshot, OLD.email),
      preferred_subcontractor_d_deleted_at = COALESCE(preferred_subcontractor_d_deleted_at, v_deleted_at),
      preferred_subcontractor_d_id = NULL
  WHERE preferred_subcontractor_d_id = OLD.id;

  RETURN OLD;
END;
$$;

UPDATE public.properties pr
SET preferred_subcontractor_d_name_snapshot = COALESCE(pr.preferred_subcontractor_d_name_snapshot, p.full_name, p.email),
    preferred_subcontractor_d_email_snapshot = COALESCE(pr.preferred_subcontractor_d_email_snapshot, p.email)
FROM public.profiles p
WHERE pr.preferred_subcontractor_d_id = p.id;

CREATE OR REPLACE FUNCTION public.decorate_job_payload_with_static_subcontractors(
  p_job_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_assigned_name text;
  v_assigned_email text;
  v_preferred jsonb;
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
BEGIN
  SELECT COALESCE(lp.full_name, lp.email, j.assigned_to_name_snapshot, j.assigned_to_email_snapshot),
         COALESCE(lp.email, j.assigned_to_email_snapshot)
    INTO v_assigned_name, v_assigned_email
  FROM public.jobs j
  LEFT JOIN public.profiles lp ON lp.id = j.assigned_to
  WHERE j.id = p_job_id;

  SELECT jsonb_build_array(
      jsonb_build_object(
        'slot', '1',
        'key', 'a',
        'id', p.preferred_subcontractor_a_id,
        'name', COALESCE(pa.full_name, pa.email, p.preferred_subcontractor_a_name_snapshot, p.preferred_subcontractor_a_email_snapshot),
        'email', COALESCE(pa.email, p.preferred_subcontractor_a_email_snapshot),
        'deleted_at', p.preferred_subcontractor_a_deleted_at
      ),
      jsonb_build_object(
        'slot', '2',
        'key', 'b',
        'id', p.preferred_subcontractor_b_id,
        'name', COALESCE(pb.full_name, pb.email, p.preferred_subcontractor_b_name_snapshot, p.preferred_subcontractor_b_email_snapshot),
        'email', COALESCE(pb.email, p.preferred_subcontractor_b_email_snapshot),
        'deleted_at', p.preferred_subcontractor_b_deleted_at
      ),
      jsonb_build_object(
        'slot', '3',
        'key', 'c',
        'id', p.preferred_subcontractor_c_id,
        'name', COALESCE(pc.full_name, pc.email, p.preferred_subcontractor_c_name_snapshot, p.preferred_subcontractor_c_email_snapshot),
        'email', COALESCE(pc.email, p.preferred_subcontractor_c_email_snapshot),
        'deleted_at', p.preferred_subcontractor_c_deleted_at
      ),
      jsonb_build_object(
        'slot', '4',
        'key', 'd',
        'id', p.preferred_subcontractor_d_id,
        'name', COALESCE(pd.full_name, pd.email, p.preferred_subcontractor_d_name_snapshot, p.preferred_subcontractor_d_email_snapshot),
        'email', COALESCE(pd.email, p.preferred_subcontractor_d_email_snapshot),
        'deleted_at', p.preferred_subcontractor_d_deleted_at
      )
    )
    INTO v_preferred
  FROM public.jobs j
  JOIN public.properties p ON p.id = j.property_id
  LEFT JOIN public.profiles pa ON pa.id = p.preferred_subcontractor_a_id
  LEFT JOIN public.profiles pb ON pb.id = p.preferred_subcontractor_b_id
  LEFT JOIN public.profiles pc ON pc.id = p.preferred_subcontractor_c_id
  LEFT JOIN public.profiles pd ON pd.id = p.preferred_subcontractor_d_id
  WHERE j.id = p_job_id;

  v_payload := v_payload || jsonb_strip_nulls(jsonb_build_object(
    'assigned_to_name', COALESCE(v_payload->>'assigned_to_name', v_assigned_name),
    'assigned_to_email', COALESCE(v_payload->>'assigned_to_email', v_assigned_email)
  ));

  IF v_payload ? 'property' THEN
    v_payload := jsonb_set(
      v_payload,
      '{property,preferred_subcontractors}',
      COALESCE(v_preferred, '[]'::jsonb),
      true
    );
  END IF;

  RETURN v_payload;
END;
$$;
