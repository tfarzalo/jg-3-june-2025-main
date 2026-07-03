-- Add Quality Control as a non-destructive job phase between Completed and Invoicing.
-- Job data freezes in this phase through the existing terminal snapshot system.
-- QC card submissions remain live in public.job_quality_control_submissions until submitted/updated.

INSERT INTO public.job_phases (
  job_phase_label,
  color_light_mode,
  color_dark_mode,
  sort_order,
  order_index
)
SELECT
  'Quality Control',
  '#D1FAE5',
  '#047857',
  105,
  105
WHERE NOT EXISTS (
  SELECT 1
  FROM public.job_phases
  WHERE job_phase_label = 'Quality Control'
);

-- Move known workflow phases into the intended order without touching jobs:
-- Job Request -> Work Order -> Pending Work Order -> Completed -> Quality Control -> Invoicing.
-- Use temporary high values first in case an environment has uniqueness on order columns.
UPDATE public.job_phases
SET
  sort_order = COALESCE(sort_order, 0) + 100,
  order_index = COALESCE(order_index, 0) + 100
WHERE job_phase_label IN (
  'Job Request',
  'Work Order',
  'Pending Work Order',
  'Completed',
  'Quality Control',
  'Invoicing',
  'Cancelled',
  'Archived'
);

UPDATE public.job_phases
SET
  sort_order = CASE job_phase_label
    WHEN 'Job Request' THEN 1
    WHEN 'Work Order' THEN 2
    WHEN 'Pending Work Order' THEN 3
    WHEN 'Completed' THEN 4
    WHEN 'Quality Control' THEN 5
    WHEN 'Invoicing' THEN 6
    WHEN 'Cancelled' THEN 7
    WHEN 'Archived' THEN 8
    ELSE sort_order
  END,
  order_index = CASE job_phase_label
    WHEN 'Job Request' THEN 1
    WHEN 'Work Order' THEN 2
    WHEN 'Pending Work Order' THEN 3
    WHEN 'Completed' THEN 4
    WHEN 'Quality Control' THEN 5
    WHEN 'Invoicing' THEN 6
    WHEN 'Cancelled' THEN 7
    WHEN 'Archived' THEN 8
    ELSE order_index
  END
WHERE job_phase_label IN (
  'Job Request',
  'Work Order',
  'Pending Work Order',
  'Completed',
  'Quality Control',
  'Invoicing',
  'Cancelled',
  'Archived'
);

CREATE OR REPLACE FUNCTION public.is_terminal_job_phase(p_phase_label text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(trim(p_phase_label), '') IN (
    'Completed',
    'Quality Control',
    'Invoicing',
    'Cancelled',
    'Archived'
  );
$$;

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
