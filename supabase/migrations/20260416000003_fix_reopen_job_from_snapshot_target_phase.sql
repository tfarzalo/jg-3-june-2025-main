-- Fix reopen_job_from_snapshot:
-- 1. Don't reject empty reason — default it so the UI never needs to pass one.
-- 2. When resolving the prior phase, skip terminal phases (e.g. Completed when
--    the job moved Completed → Invoicing) so we always land on a live phase.
-- 3. Ultimate fallback is always 'Work Order', never another terminal phase.

CREATE OR REPLACE FUNCTION public.reopen_job_from_snapshot(
  p_job_id uuid,
  p_reason text,
  p_target_phase_label text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_job public.jobs%ROWTYPE;
  v_current_phase_label text;
  v_snapshot_id uuid;
  v_target_phase_id uuid;
  v_target_phase_label text;
  v_prior_phase_id uuid;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT role
    INTO v_actor_role
  FROM public.profiles
  WHERE id = v_actor_id;

  IF v_actor_role NOT IN ('admin', 'jg_management', 'is_super_admin') THEN
    RAISE EXCEPTION 'Only admin or management users can reopen frozen jobs';
  END IF;

  -- Allow empty/null reason — default it so the function never blocks
  IF COALESCE(trim(p_reason), '') = '' THEN
    p_reason := 'Reopened by user';
  END IF;

  SELECT *
    INTO v_job
  FROM public.jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job % not found', p_job_id;
  END IF;

  SELECT job_phase_label
    INTO v_current_phase_label
  FROM public.job_phases
  WHERE id = v_job.current_phase_id;

  IF NOT public.is_terminal_job_phase(v_current_phase_label) THEN
    RAISE EXCEPTION 'Job % is not currently in a terminal phase', p_job_id;
  END IF;

  v_snapshot_id := v_job.active_snapshot_id;

  IF v_snapshot_id IS NULL THEN
    v_snapshot_id := public.create_or_refresh_job_snapshot(
      p_job_id,
      'Automatic snapshot before reopen',
      v_actor_id,
      true
    );
  END IF;

  -- Determine target phase
  IF p_target_phase_label IS NOT NULL AND NOT public.is_terminal_job_phase(p_target_phase_label) THEN
    SELECT id, job_phase_label
      INTO v_target_phase_id, v_target_phase_label
    FROM public.job_phases
    WHERE job_phase_label = p_target_phase_label
    LIMIT 1;
  ELSE
    -- Walk back through phase history to find the most recent non-terminal phase
    SELECT jpc.from_phase_id
      INTO v_prior_phase_id
    FROM public.job_phase_changes jpc
    JOIN public.job_phases jp ON jp.id = jpc.from_phase_id
    WHERE jpc.job_id = p_job_id
      AND jpc.from_phase_id IS NOT NULL
      AND NOT public.is_terminal_job_phase(jp.job_phase_label)
    ORDER BY jpc.changed_at DESC
    LIMIT 1;

    IF v_prior_phase_id IS NOT NULL THEN
      SELECT id, job_phase_label
        INTO v_target_phase_id, v_target_phase_label
      FROM public.job_phases
      WHERE id = v_prior_phase_id;
    END IF;
  END IF;

  -- Ultimate fallback: always use Work Order
  IF v_target_phase_id IS NULL OR public.is_terminal_job_phase(v_target_phase_label) THEN
    SELECT id, job_phase_label
      INTO v_target_phase_id, v_target_phase_label
    FROM public.job_phases
    WHERE job_phase_label = 'Work Order'
    LIMIT 1;
  END IF;

  IF v_target_phase_id IS NULL THEN
    RAISE EXCEPTION 'Could not determine a non-terminal reopen phase for job %', p_job_id;
  END IF;

  UPDATE public.job_snapshots
  SET is_current = false,
      reopened_at = now(),
      reopened_by = v_actor_id,
      reopen_reason = p_reason,
      updated_at = now()
  WHERE id = v_snapshot_id;

  UPDATE public.jobs
  SET current_phase_id = v_target_phase_id,
      active_snapshot_id = NULL,
      historical_data_mode = 'live',
      snapshot_last_phase_label = v_current_phase_label
  WHERE id = p_job_id;

  INSERT INTO public.job_phase_changes (
    job_id,
    changed_by,
    from_phase_id,
    to_phase_id,
    change_reason
  ) VALUES (
    p_job_id,
    v_actor_id,
    v_job.current_phase_id,
    v_target_phase_id,
    'Job reopened from ' || v_current_phase_label || ': ' || p_reason
  );

  RETURN jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'reopened_snapshot_id', v_snapshot_id,
    'from_phase', v_current_phase_label,
    'to_phase', v_target_phase_label,
    'reason', p_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reopen_job_from_snapshot(uuid, text, text) TO authenticated;
