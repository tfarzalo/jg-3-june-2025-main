-- Freeze completed and archived jobs into immutable snapshots so terminal jobs
-- render historical data instead of live relational data.

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
      AND p.proname = 'get_job_details_live'
      AND oidvectortypes(p.proargtypes) = 'uuid'
  ) THEN
    EXECUTE 'ALTER FUNCTION public.get_job_details(uuid) RENAME TO get_job_details_live';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.job_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  snapshot_version integer NOT NULL,
  snapshot_phase_label text NOT NULL,
  snapshot_payload jsonb NOT NULL,
  total_bill numeric(12,2),
  total_sub_pay numeric(12,2),
  total_profit numeric(12,2),
  frozen_at timestamptz NOT NULL DEFAULT now(),
  frozen_by uuid REFERENCES public.profiles(id),
  reopened_at timestamptz,
  reopened_by uuid REFERENCES public.profiles(id),
  reopen_reason text,
  replaced_at timestamptz,
  is_current boolean NOT NULL DEFAULT true,
  backfilled_from_live boolean NOT NULL DEFAULT false,
  schema_version integer NOT NULL DEFAULT 1,
  calculation_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_snapshots_job_version_key UNIQUE (job_id, snapshot_version)
);

CREATE UNIQUE INDEX IF NOT EXISTS job_snapshots_one_current_per_job_idx
  ON public.job_snapshots(job_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS job_snapshots_job_frozen_at_idx
  ON public.job_snapshots(job_id, frozen_at DESC);

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS active_snapshot_id uuid REFERENCES public.job_snapshots(id),
  ADD COLUMN IF NOT EXISTS historical_data_mode text NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS snapshot_frozen_at timestamptz,
  ADD COLUMN IF NOT EXISTS snapshot_last_phase_label text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_historical_data_mode_check'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_historical_data_mode_check
      CHECK (historical_data_mode IN ('live', 'snapshot'));
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.is_terminal_job_phase(p_phase_label text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(trim(p_phase_label), '') IN ('Completed', 'Archived');
$$;

CREATE OR REPLACE FUNCTION public.build_work_order_frozen_billing_lines(p_work_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH target_work_order AS (
    SELECT *
    FROM public.work_orders
    WHERE id = p_work_order_id
    LIMIT 1
  ),
  frozen_lines AS (
    SELECT
      'painted_ceilings'::text AS key,
      format(
        'Painted Ceilings (%s)',
        CASE
          WHEN wo.ceiling_display_label = 'Paint Individual Ceiling' THEN 'Individual'
          ELSE COALESCE(wo.ceiling_display_label, 'Unit')
        END
      ) AS label,
      CASE
        WHEN wo.ceiling_display_label = 'Paint Individual Ceiling'
          THEN GREATEST(COALESCE(wo.individual_ceiling_count, 0), 0)::numeric
        ELSE 1::numeric
      END AS qty,
      CASE
        WHEN wo.ceiling_display_label = 'Paint Individual Ceiling'
          THEN 'Paint Individual Ceiling'
        ELSE wo.ceiling_display_label
      END AS unit_label,
      COALESCE(bd.bill_amount, 0)::numeric AS rate_bill,
      COALESCE(bd.sub_pay_amount, 0)::numeric AS rate_sub,
      COALESCE(cat.sort_order, bd.sort_order, 0) AS order_key
    FROM target_work_order wo
    JOIN public.billing_details bd ON bd.id = wo.ceiling_billing_detail_id
    LEFT JOIN public.billing_categories cat ON cat.id = bd.category_id
    WHERE wo.painted_ceilings IS TRUE
      AND wo.ceiling_billing_detail_id IS NOT NULL

    UNION ALL

    SELECT
      'accent_wall'::text AS key,
      'Accent Wall' || COALESCE(' (' || NULLIF(wo.accent_wall_type, '') || ')', '') AS label,
      GREATEST(COALESCE(NULLIF(wo.accent_wall_count, 0), 1), 1)::numeric AS qty,
      'Per Wall'::text AS unit_label,
      COALESCE(bd.bill_amount, 0)::numeric AS rate_bill,
      COALESCE(bd.sub_pay_amount, 0)::numeric AS rate_sub,
      COALESCE(cat.sort_order, bd.sort_order, 0) AS order_key
    FROM target_work_order wo
    JOIN public.billing_details bd ON bd.id = wo.accent_wall_billing_detail_id
    LEFT JOIN public.billing_categories cat ON cat.id = bd.category_id
    WHERE wo.has_accent_wall IS TRUE
      AND wo.accent_wall_billing_detail_id IS NOT NULL

    UNION ALL

    SELECT
      'additional_' || svc.service_key AS key,
      CASE
        WHEN NULLIF(svc.service_value->>'description', '') IS NOT NULL
          THEN COALESCE(cat.name, 'Additional Service')
            || COALESCE(' (' || us.unit_size_label || ')', '')
            || ' - ' || (svc.service_value->>'description')
        ELSE COALESCE(cat.name, 'Additional Service')
            || COALESCE(' (' || us.unit_size_label || ')', '')
      END AS label,
      GREATEST(COALESCE(NULLIF(svc.service_value->>'quantity', '')::numeric, 1), 1) AS qty,
      us.unit_size_label AS unit_label,
      COALESCE(bd.bill_amount, 0)::numeric AS rate_bill,
      COALESCE(bd.sub_pay_amount, 0)::numeric AS rate_sub,
      COALESCE(cat.sort_order, bd.sort_order, 0) AS order_key
    FROM target_work_order wo
    CROSS JOIN LATERAL jsonb_each(
      CASE
        WHEN jsonb_typeof(COALESCE(wo.additional_services, '{}'::jsonb)) = 'object'
          THEN COALESCE(wo.additional_services, '{}'::jsonb)
        ELSE '{}'::jsonb
      END
    ) AS svc(service_key, service_value)
    JOIN public.billing_details bd ON bd.id = NULLIF(svc.service_value->>'billing_detail_id', '')::uuid
    LEFT JOIN public.billing_categories cat ON cat.id = bd.category_id
    LEFT JOIN public.unit_sizes us ON us.id = bd.unit_size_id
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', key,
        'label', label,
        'qty', qty,
        'unitLabel', unit_label,
        'rateBill', rate_bill,
        'rateSub', rate_sub,
        'amountBill', qty * rate_bill,
        'amountSub', qty * rate_sub,
        'orderKey', order_key
      )
      ORDER BY order_key, label
    ),
    '[]'::jsonb
  )
  FROM frozen_lines;
$$;

CREATE OR REPLACE FUNCTION public.create_or_refresh_job_snapshot(
  p_job_id uuid,
  p_reason text DEFAULT NULL,
  p_created_by uuid DEFAULT auth.uid(),
  p_backfilled boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phase_label text;
  v_existing_snapshot_id uuid;
  v_existing_snapshot_phase text;
  v_payload jsonb;
  v_snapshot_id uuid;
  v_next_version integer;
  v_work_order_id uuid;
  v_frozen_lines jsonb := '[]'::jsonb;
  v_frozen_at timestamptz := now();
  v_total_bill numeric(12,2) := 0;
  v_total_sub numeric(12,2) := 0;
  v_line_bill numeric(12,2) := 0;
  v_line_sub numeric(12,2) := 0;
  v_extra_items_bill numeric(12,2) := 0;
  v_extra_items_sub numeric(12,2) := 0;
BEGIN
  SELECT jp.job_phase_label, j.active_snapshot_id
    INTO v_phase_label, v_existing_snapshot_id
  FROM public.jobs j
  LEFT JOIN public.job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job % not found', p_job_id;
  END IF;

  IF NOT public.is_terminal_job_phase(v_phase_label) THEN
    RETURN NULL;
  END IF;

  IF v_existing_snapshot_id IS NOT NULL THEN
    SELECT snapshot_phase_label
      INTO v_existing_snapshot_phase
    FROM public.job_snapshots
    WHERE id = v_existing_snapshot_id;

    IF v_existing_snapshot_phase = v_phase_label THEN
      UPDATE public.jobs
      SET historical_data_mode = 'snapshot',
          snapshot_last_phase_label = v_phase_label
      WHERE id = p_job_id;

      RETURN v_existing_snapshot_id;
    END IF;
  END IF;

  v_payload := public.get_job_details_live(p_job_id);
  v_work_order_id := NULLIF(v_payload->'work_order'->>'id', '')::uuid;

  IF v_work_order_id IS NOT NULL THEN
    v_frozen_lines := public.build_work_order_frozen_billing_lines(v_work_order_id);
    v_payload := jsonb_set(
      v_payload,
      '{work_order,frozen_billing_lines}',
      COALESCE(v_frozen_lines, '[]'::jsonb),
      true
    );
  END IF;

  SELECT COALESCE(SUM((line->>'amountBill')::numeric), 0),
         COALESCE(SUM((line->>'amountSub')::numeric), 0)
    INTO v_line_bill, v_line_sub
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(COALESCE(v_frozen_lines, '[]'::jsonb)) = 'array'
        THEN COALESCE(v_frozen_lines, '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  ) AS line;

  SELECT COALESCE(SUM(
           COALESCE((item->>'calculatedBillAmount')::numeric, 0)
           + CASE
               WHEN item ? 'calculatedBillAmount' THEN 0
               ELSE COALESCE((item->>'quantity')::numeric, 0) * COALESCE((item->>'billRate')::numeric, 0)
             END
         ), 0),
         COALESCE(SUM(
           COALESCE((item->>'calculatedSubAmount')::numeric, 0)
           + CASE
               WHEN item ? 'calculatedSubAmount' THEN 0
               ELSE COALESCE((item->>'quantity')::numeric, 0) * COALESCE((item->>'subRate')::numeric, 0)
             END
         ), 0)
    INTO v_extra_items_bill, v_extra_items_sub
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(COALESCE(v_payload->'work_order'->'extra_charges_line_items', '[]'::jsonb)) = 'array'
        THEN COALESCE(v_payload->'work_order'->'extra_charges_line_items', '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  ) AS item;

  v_total_bill :=
    COALESCE((v_payload->'billing_details'->>'bill_amount')::numeric, 0)
    + COALESCE((v_payload->'extra_charges_details'->>'bill_amount')::numeric, 0)
    + COALESCE((v_payload->>'repair_amount')::numeric, 0)
    + COALESCE(v_extra_items_bill, 0)
    + COALESCE(v_line_bill, 0);

  v_total_sub :=
    COALESCE((v_payload->'billing_details'->>'sub_pay_amount')::numeric, 0)
    + COALESCE((v_payload->'extra_charges_details'->>'sub_pay_amount')::numeric, 0)
    + COALESCE((v_payload->>'repair_sub_pay')::numeric, 0)
    + COALESCE(v_extra_items_sub, 0)
    + COALESCE(v_line_sub, 0);

  UPDATE public.job_snapshots
  SET is_current = false,
      replaced_at = v_frozen_at,
      updated_at = v_frozen_at
  WHERE job_id = p_job_id
    AND is_current = true;

  SELECT COALESCE(MAX(snapshot_version), 0) + 1
    INTO v_next_version
  FROM public.job_snapshots
  WHERE job_id = p_job_id;

  INSERT INTO public.job_snapshots (
    job_id,
    snapshot_version,
    snapshot_phase_label,
    snapshot_payload,
    total_bill,
    total_sub_pay,
    total_profit,
    frozen_at,
    frozen_by,
    is_current,
    backfilled_from_live,
    updated_at
  ) VALUES (
    p_job_id,
    v_next_version,
    v_phase_label,
    v_payload,
    v_total_bill,
    v_total_sub,
    v_total_bill - v_total_sub,
    v_frozen_at,
    p_created_by,
    true,
    p_backfilled,
    v_frozen_at
  )
  RETURNING id INTO v_snapshot_id;

  UPDATE public.jobs
  SET active_snapshot_id = v_snapshot_id,
      historical_data_mode = 'snapshot',
      snapshot_frozen_at = v_frozen_at,
      snapshot_last_phase_label = v_phase_label,
      total_billing_amount = COALESCE(v_total_bill, total_billing_amount)
  WHERE id = p_job_id;

  RETURN v_snapshot_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_job_details(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phase_label text;
  v_snapshot_id uuid;
  v_snapshot_payload jsonb;
  v_snapshot_frozen_at timestamptz;
  v_live_payload jsonb;
BEGIN
  SELECT jp.job_phase_label, j.active_snapshot_id
    INTO v_phase_label, v_snapshot_id
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
      RETURN v_snapshot_payload
        || jsonb_build_object(
          'historical_data_mode', 'snapshot',
          'active_snapshot_id', v_snapshot_id,
          'snapshot_frozen_at', v_snapshot_frozen_at,
          'snapshot_phase_label', v_phase_label
        );
    END IF;
  END IF;

  v_live_payload := public.get_job_details_live(p_job_id);

  RETURN v_live_payload
    || jsonb_build_object(
      'historical_data_mode', 'live',
      'active_snapshot_id', NULL,
      'snapshot_frozen_at', NULL,
      'snapshot_phase_label', NULL
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.job_terminal_snapshot_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phase_label text;
BEGIN
  SELECT job_phase_label
    INTO v_phase_label
  FROM public.job_phases
  WHERE id = NEW.current_phase_id;

  IF public.is_terminal_job_phase(v_phase_label) THEN
    PERFORM public.create_or_refresh_job_snapshot(
      NEW.id,
      'Automatic terminal job snapshot on phase change',
      auth.uid(),
      false
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_job_terminal_snapshot ON public.jobs;

CREATE TRIGGER trigger_job_terminal_snapshot
AFTER INSERT OR UPDATE OF current_phase_id
ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.job_terminal_snapshot_trigger();

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

  IF COALESCE(trim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'A reopen reason is required';
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

  IF p_target_phase_label IS NOT NULL THEN
    SELECT id, job_phase_label
      INTO v_target_phase_id, v_target_phase_label
    FROM public.job_phases
    WHERE job_phase_label = p_target_phase_label
    LIMIT 1;
  ELSE
    SELECT jpc.from_phase_id
      INTO v_prior_phase_id
    FROM public.job_phase_changes jpc
    WHERE jpc.job_id = p_job_id
      AND jpc.to_phase_id = v_job.current_phase_id
      AND jpc.from_phase_id IS NOT NULL
    ORDER BY jpc.changed_at DESC
    LIMIT 1;

    IF v_prior_phase_id IS NOT NULL THEN
      SELECT id, job_phase_label
        INTO v_target_phase_id, v_target_phase_label
      FROM public.job_phases
      WHERE id = v_prior_phase_id;
    END IF;
  END IF;

  IF v_target_phase_id IS NULL THEN
    SELECT id, job_phase_label
      INTO v_target_phase_id, v_target_phase_label
    FROM public.job_phases
    WHERE job_phase_label = CASE
      WHEN v_current_phase_label = 'Completed' THEN 'Invoicing'
      ELSE 'Job Request'
    END
    LIMIT 1;
  END IF;

  IF v_target_phase_id IS NULL OR public.is_terminal_job_phase(v_target_phase_label) THEN
    RAISE EXCEPTION 'A non-terminal reopen phase is required';
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

GRANT EXECUTE ON FUNCTION public.get_job_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_job_details_live(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_refresh_job_snapshot(uuid, text, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_job_from_snapshot(uuid, text, text) TO authenticated;

DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT j.id
    FROM public.jobs j
    JOIN public.job_phases jp ON jp.id = j.current_phase_id
    WHERE public.is_terminal_job_phase(jp.job_phase_label)
      AND j.active_snapshot_id IS NULL
  LOOP
    PERFORM public.create_or_refresh_job_snapshot(
      v_job.id,
      'Backfill snapshot for existing terminal job',
      NULL,
      true
    );
  END LOOP;
END
$$;
