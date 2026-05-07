-- Preserve subcontractor assignment and preferred-slot labels for historical jobs.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS assigned_to_name_snapshot text,
  ADD COLUMN IF NOT EXISTS assigned_to_email_snapshot text,
  ADD COLUMN IF NOT EXISTS assigned_to_deleted_at timestamptz;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_a_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_b_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_c_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_a_name_snapshot text,
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_a_email_snapshot text,
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_a_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_b_name_snapshot text,
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_b_email_snapshot text,
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_b_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_c_name_snapshot text,
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_c_email_snapshot text,
  ADD COLUMN IF NOT EXISTS preferred_subcontractor_c_deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_properties_preferred_subcontractor_a_id
  ON public.properties(preferred_subcontractor_a_id);

CREATE INDEX IF NOT EXISTS idx_properties_preferred_subcontractor_b_id
  ON public.properties(preferred_subcontractor_b_id);

CREATE INDEX IF NOT EXISTS idx_properties_preferred_subcontractor_c_id
  ON public.properties(preferred_subcontractor_c_id);

CREATE OR REPLACE FUNCTION public.sync_job_assigned_to_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_profile record;
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR (TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to)
     ) THEN
    SELECT full_name, email
      INTO v_profile
    FROM public.profiles
    WHERE id = NEW.assigned_to;

    NEW.assigned_to_name_snapshot := COALESCE(v_profile.full_name, v_profile.email, NEW.assigned_to_name_snapshot);
    NEW.assigned_to_email_snapshot := COALESCE(v_profile.email, NEW.assigned_to_email_snapshot);
    NEW.assigned_to_deleted_at := NULL;
  ELSIF NEW.assigned_to IS NULL
        AND TG_OP = 'UPDATE'
        AND OLD.assigned_to IS NOT NULL
        AND NEW.assigned_to_deleted_at IS NULL THEN
    NEW.assigned_to_name_snapshot := NULL;
    NEW.assigned_to_email_snapshot := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_job_assigned_to_snapshot ON public.jobs;

CREATE TRIGGER trigger_sync_job_assigned_to_snapshot
BEFORE INSERT OR UPDATE OF assigned_to, assigned_to_deleted_at
ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.sync_job_assigned_to_snapshot();

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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_property_preferred_subcontractor_snapshot ON public.properties;

CREATE TRIGGER trigger_sync_property_preferred_subcontractor_snapshot
BEFORE INSERT OR UPDATE OF
  preferred_subcontractor_a_id,
  preferred_subcontractor_b_id,
  preferred_subcontractor_c_id,
  preferred_subcontractor_a_deleted_at,
  preferred_subcontractor_b_deleted_at,
  preferred_subcontractor_c_deleted_at
ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.sync_property_preferred_subcontractor_snapshot();

UPDATE public.jobs j
SET assigned_to_name_snapshot = COALESCE(j.assigned_to_name_snapshot, p.full_name, p.email),
    assigned_to_email_snapshot = COALESCE(j.assigned_to_email_snapshot, p.email)
FROM public.profiles p
WHERE j.assigned_to = p.id;

UPDATE public.properties pr
SET preferred_subcontractor_a_name_snapshot = COALESCE(pr.preferred_subcontractor_a_name_snapshot, p.full_name, p.email),
    preferred_subcontractor_a_email_snapshot = COALESCE(pr.preferred_subcontractor_a_email_snapshot, p.email)
FROM public.profiles p
WHERE pr.preferred_subcontractor_a_id = p.id;

UPDATE public.properties pr
SET preferred_subcontractor_b_name_snapshot = COALESCE(pr.preferred_subcontractor_b_name_snapshot, p.full_name, p.email),
    preferred_subcontractor_b_email_snapshot = COALESCE(pr.preferred_subcontractor_b_email_snapshot, p.email)
FROM public.profiles p
WHERE pr.preferred_subcontractor_b_id = p.id;

UPDATE public.properties pr
SET preferred_subcontractor_c_name_snapshot = COALESCE(pr.preferred_subcontractor_c_name_snapshot, p.full_name, p.email),
    preferred_subcontractor_c_email_snapshot = COALESCE(pr.preferred_subcontractor_c_email_snapshot, p.email)
FROM public.profiles p
WHERE pr.preferred_subcontractor_c_id = p.id;

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
      )
    )
    INTO v_preferred
  FROM public.jobs j
  JOIN public.properties p ON p.id = j.property_id
  LEFT JOIN public.profiles pa ON pa.id = p.preferred_subcontractor_a_id
  LEFT JOIN public.profiles pb ON pb.id = p.preferred_subcontractor_b_id
  LEFT JOIN public.profiles pc ON pc.id = p.preferred_subcontractor_c_id
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

CREATE OR REPLACE FUNCTION public.decorate_job_snapshot_payload()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.snapshot_payload := public.decorate_job_payload_with_static_subcontractors(NEW.job_id, NEW.snapshot_payload);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_decorate_job_snapshot_payload ON public.job_snapshots;

CREATE TRIGGER trigger_decorate_job_snapshot_payload
BEFORE INSERT OR UPDATE OF snapshot_payload
ON public.job_snapshots
FOR EACH ROW
EXECUTE FUNCTION public.decorate_job_snapshot_payload();

CREATE OR REPLACE FUNCTION public.get_job_details(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_phase_label text;
  v_phase_id uuid;
  v_phase_color_light text;
  v_phase_color_dark text;
  v_snapshot_id uuid;
  v_snapshot_payload jsonb;
  v_snapshot_frozen_at timestamptz;
  v_live_payload jsonb;
BEGIN
  SELECT jp.job_phase_label, jp.id, jp.color_light_mode, jp.color_dark_mode,
         j.active_snapshot_id
    INTO v_phase_label, v_phase_id, v_phase_color_light, v_phase_color_dark,
         v_snapshot_id
  FROM public.jobs j
  LEFT JOIN public.job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = p_job_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF public.is_terminal_job_phase(v_phase_label) THEN
    IF v_snapshot_id IS NULL THEN
      v_snapshot_id := public.create_or_refresh_job_snapshot(
        p_job_id,
        'Automatic terminal job snapshot',
        auth.uid(),
        true
      );
    END IF;

    SELECT snapshot_payload, frozen_at
      INTO v_snapshot_payload, v_snapshot_frozen_at
    FROM public.job_snapshots
    WHERE id = v_snapshot_id;

    IF v_snapshot_payload IS NOT NULL THEN
      RETURN public.decorate_job_payload_with_static_subcontractors(p_job_id, v_snapshot_payload)
        || jsonb_build_object(
          'job_phase', jsonb_build_object(
            'id',               v_phase_id,
            'label',            v_phase_label,
            'job_phase_label',  v_phase_label,
            'color_light_mode', v_phase_color_light,
            'color_dark_mode',  v_phase_color_dark
          ),
          'historical_data_mode', 'snapshot',
          'active_snapshot_id',   v_snapshot_id,
          'snapshot_frozen_at',   v_snapshot_frozen_at,
          'snapshot_phase_label', v_phase_label
        );
    END IF;
  END IF;

  v_live_payload := public.decorate_job_payload_with_static_subcontractors(
    p_job_id,
    public.get_job_details_live(p_job_id)
  );

  RETURN v_live_payload
    || jsonb_build_object(
      'historical_data_mode', 'live',
      'active_snapshot_id',   NULL,
      'snapshot_frozen_at',   NULL,
      'snapshot_phase_label', NULL
    );
END;
$function$;

UPDATE public.job_snapshots
SET snapshot_payload = public.decorate_job_payload_with_static_subcontractors(job_id, snapshot_payload),
    updated_at = now()
WHERE is_current = true;

GRANT EXECUTE ON FUNCTION public.decorate_job_payload_with_static_subcontractors(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_job_details(uuid) TO authenticated;
