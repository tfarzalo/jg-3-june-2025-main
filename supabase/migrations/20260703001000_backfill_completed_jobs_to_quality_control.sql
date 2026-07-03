-- Idempotent follow-up for installs that ran the Quality Control phase migration
-- before the existing Completed-job backfill was added.
--
-- This moves jobs still in Completed into Quality Control so they appear in the
-- QC queue. Existing QC submissions stay attached by job_id and are not changed.

DO $$
DECLARE
  v_completed_phase_id uuid;
  v_quality_control_phase_id uuid;
  v_actor_id uuid;
  v_backfilled_count integer := 0;
BEGIN
  SELECT id
    INTO v_completed_phase_id
  FROM public.job_phases
  WHERE job_phase_label = 'Completed';

  SELECT id
    INTO v_quality_control_phase_id
  FROM public.job_phases
  WHERE job_phase_label = 'Quality Control';

  IF v_completed_phase_id IS NULL OR v_quality_control_phase_id IS NULL THEN
    RAISE NOTICE 'Skipping Completed -> Quality Control backfill because one of the phases is missing.';
    RETURN;
  END IF;

  SELECT id
    INTO v_actor_id
  FROM public.profiles
  WHERE role IN ('admin', 'is_super_admin', 'jg_management')
  ORDER BY
    CASE role
      WHEN 'is_super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'jg_management' THEN 3
      ELSE 4
    END,
    created_at NULLS LAST
  LIMIT 1;

  IF v_actor_id IS NULL THEN
    SELECT id
      INTO v_actor_id
    FROM public.profiles
    ORDER BY created_at NULLS LAST
    LIMIT 1;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS qc_phase_backfill_jobs (
    job_id uuid PRIMARY KEY,
    from_phase_id uuid NOT NULL
  ) ON COMMIT DROP;

  TRUNCATE qc_phase_backfill_jobs;

  INSERT INTO qc_phase_backfill_jobs (job_id, from_phase_id)
  SELECT j.id, j.current_phase_id
  FROM public.jobs j
  WHERE j.current_phase_id = v_completed_phase_id;

  UPDATE public.jobs j
  SET current_phase_id = v_quality_control_phase_id
  FROM qc_phase_backfill_jobs b
  WHERE j.id = b.job_id;

  GET DIAGNOSTICS v_backfilled_count = ROW_COUNT;

  IF v_actor_id IS NOT NULL THEN
    INSERT INTO public.job_phase_changes (
      job_id,
      changed_by,
      from_phase_id,
      to_phase_id,
      change_reason
    )
    SELECT
      b.job_id,
      v_actor_id,
      b.from_phase_id,
      v_quality_control_phase_id,
      'Backfilled into Quality Control phase after workflow update'
    FROM qc_phase_backfill_jobs b
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.job_phase_changes existing
      WHERE existing.job_id = b.job_id
        AND existing.from_phase_id = b.from_phase_id
        AND existing.to_phase_id = v_quality_control_phase_id
        AND existing.change_reason = 'Backfilled into Quality Control phase after workflow update'
    );
  ELSE
    RAISE NOTICE 'Moved % Completed jobs into Quality Control without phase-change rows because no profile exists for changed_by.', v_backfilled_count;
  END IF;

  RAISE NOTICE 'Moved % existing Completed jobs into Quality Control.', v_backfilled_count;
END
$$;

DO $$
DECLARE
  v_job record;
BEGIN
  IF to_regprocedure('public.create_or_refresh_job_snapshot(uuid,text,uuid,boolean)') IS NULL THEN
    RAISE NOTICE 'Skipping Quality Control snapshot backfill because create_or_refresh_job_snapshot is not installed.';
    RETURN;
  END IF;

  FOR v_job IN
    SELECT j.id
    FROM public.jobs j
    JOIN public.job_phases jp ON jp.id = j.current_phase_id
    WHERE jp.job_phase_label = 'Quality Control'
      AND j.active_snapshot_id IS NULL
  LOOP
    PERFORM public.create_or_refresh_job_snapshot(
      v_job.id,
      'Backfill snapshot for existing Quality Control job',
      NULL,
      true
    );
  END LOOP;
END
$$;
