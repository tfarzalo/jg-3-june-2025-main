-- Fix: when a job already has a frozen snapshot and moves between terminal phases
-- (e.g. Completed → Invoicing), preserve the existing snapshot instead of
-- creating a new one from live data.  Only take a fresh snapshot when entering
-- a terminal phase from a non-terminal phase.

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

  -- If an existing snapshot already exists, handle it:
  IF v_existing_snapshot_id IS NOT NULL THEN
    SELECT snapshot_phase_label
      INTO v_existing_snapshot_phase
    FROM public.job_snapshots
    WHERE id = v_existing_snapshot_id;

    -- Same phase: just ensure the mode flag is set and return.
    IF v_existing_snapshot_phase = v_phase_label THEN
      UPDATE public.jobs
      SET historical_data_mode = 'snapshot',
          snapshot_last_phase_label = v_phase_label
      WHERE id = p_job_id;
      RETURN v_existing_snapshot_id;
    END IF;

    -- Different terminal phase (e.g. Completed → Invoicing):
    -- PRESERVE the existing snapshot — do NOT take a new live snapshot.
    -- Just update the jobs row so the existing snapshot is still active
    -- and the historical_data_mode flag is correctly set.
    IF public.is_terminal_job_phase(v_existing_snapshot_phase) THEN
      UPDATE public.jobs
      SET historical_data_mode = 'snapshot',
          snapshot_last_phase_label = v_phase_label
      WHERE id = p_job_id;
      RETURN v_existing_snapshot_id;
    END IF;
  END IF;

  -- No prior terminal snapshot exists — take a fresh snapshot from live data.
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
