-- Add cancellation trip charge support and freeze Cancelled jobs as terminal history.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS cancellation_trip_charge_added boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_trip_charge_bill_amount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_trip_charge_sub_pay_amount numeric(12,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.is_terminal_job_phase(p_phase_label text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(trim(p_phase_label), '') IN ('Completed', 'Invoicing', 'Cancelled', 'Archived');
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
  v_trip_charge_added boolean := false;
  v_trip_charge_bill numeric(12,2) := 0;
  v_trip_charge_sub numeric(12,2) := 0;
BEGIN
  SELECT jp.job_phase_label,
         j.active_snapshot_id,
         COALESCE(j.cancellation_trip_charge_added, false),
         COALESCE(j.cancellation_trip_charge_bill_amount, 0),
         COALESCE(j.cancellation_trip_charge_sub_pay_amount, 0)
    INTO v_phase_label,
         v_existing_snapshot_id,
         v_trip_charge_added,
         v_trip_charge_bill,
         v_trip_charge_sub
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
      UPDATE public.job_snapshots
      SET snapshot_payload = snapshot_payload || jsonb_build_object(
            'cancellation_trip_charge_added', v_trip_charge_added,
            'cancellation_trip_charge_bill_amount', v_trip_charge_bill,
            'cancellation_trip_charge_sub_pay_amount', v_trip_charge_sub
          ),
          total_bill = CASE
            WHEN v_phase_label = 'Cancelled' THEN CASE WHEN v_trip_charge_added THEN v_trip_charge_bill ELSE 0 END
            ELSE COALESCE(total_bill, 0)
          END,
          total_sub_pay = CASE
            WHEN v_phase_label = 'Cancelled' THEN CASE WHEN v_trip_charge_added THEN v_trip_charge_sub ELSE 0 END
            ELSE COALESCE(total_sub_pay, 0)
          END,
          total_profit = CASE
            WHEN v_phase_label = 'Cancelled'
              THEN (CASE WHEN v_trip_charge_added THEN v_trip_charge_bill ELSE 0 END)
                - (CASE WHEN v_trip_charge_added THEN v_trip_charge_sub ELSE 0 END)
            ELSE COALESCE(total_profit, 0)
          END,
          updated_at = v_frozen_at
      WHERE id = v_existing_snapshot_id
        AND COALESCE(snapshot_payload->>'cancellation_trip_charge_added', 'false') <> v_trip_charge_added::text;

      UPDATE public.jobs
      SET historical_data_mode = 'snapshot',
          snapshot_last_phase_label = v_phase_label
      WHERE id = p_job_id;
      RETURN v_existing_snapshot_id;
    END IF;

    IF public.is_terminal_job_phase(v_existing_snapshot_phase) THEN
      UPDATE public.jobs
      SET historical_data_mode = 'snapshot',
          snapshot_last_phase_label = v_phase_label
      WHERE id = p_job_id;
      RETURN v_existing_snapshot_id;
    END IF;
  END IF;

  v_payload := public.get_job_details_live(p_job_id)
    || jsonb_build_object(
      'cancellation_trip_charge_added', v_trip_charge_added,
      'cancellation_trip_charge_bill_amount', v_trip_charge_bill,
      'cancellation_trip_charge_sub_pay_amount', v_trip_charge_sub
    );
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

  IF v_phase_label = 'Cancelled' THEN
    v_total_bill := CASE WHEN v_trip_charge_added THEN COALESCE(v_trip_charge_bill, 0) ELSE 0 END;
    v_total_sub := CASE WHEN v_trip_charge_added THEN COALESCE(v_trip_charge_sub, 0) ELSE 0 END;
  ELSE
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
  END IF;

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
  v_phase_id uuid;
  v_phase_color_light text;
  v_phase_color_dark text;
  v_snapshot_id uuid;
  v_snapshot_payload jsonb;
  v_snapshot_frozen_at timestamptz;
  v_live_payload jsonb;
  v_trip_charge_added boolean := false;
  v_trip_charge_bill numeric(12,2) := 0;
  v_trip_charge_sub numeric(12,2) := 0;
BEGIN
  SELECT jp.job_phase_label,
         jp.id,
         jp.color_light_mode,
         jp.color_dark_mode,
         j.active_snapshot_id,
         COALESCE(j.cancellation_trip_charge_added, false),
         COALESCE(j.cancellation_trip_charge_bill_amount, 0),
         COALESCE(j.cancellation_trip_charge_sub_pay_amount, 0)
    INTO v_phase_label,
         v_phase_id,
         v_phase_color_light,
         v_phase_color_dark,
         v_snapshot_id,
         v_trip_charge_added,
         v_trip_charge_bill,
         v_trip_charge_sub
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
          'cancellation_trip_charge_added', v_trip_charge_added,
          'cancellation_trip_charge_bill_amount', v_trip_charge_bill,
          'cancellation_trip_charge_sub_pay_amount', v_trip_charge_sub,
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
      'cancellation_trip_charge_added', v_trip_charge_added,
      'cancellation_trip_charge_bill_amount', v_trip_charge_bill,
      'cancellation_trip_charge_sub_pay_amount', v_trip_charge_sub,
      'historical_data_mode', 'live',
      'active_snapshot_id',   NULL,
      'snapshot_frozen_at',   NULL,
      'snapshot_phase_label', NULL
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_or_refresh_job_snapshot(uuid, text, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_job_details(uuid) TO authenticated;
