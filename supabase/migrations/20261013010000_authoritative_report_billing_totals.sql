-- Give reports the same authoritative billing contract as Job Details.
-- No job, work-order, approval, snapshot, or historical amount is modified.

CREATE OR REPLACE FUNCTION public.report_numeric(p_value text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN COALESCE(p_value, '') ~ '^-?[0-9]+([.][0-9]+)?$' THEN p_value::numeric
    ELSE 0::numeric
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_job_details_with_billing_totals(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_details jsonb;
  v_job record;
  v_snapshot record;
  v_work_order jsonb;
  v_base jsonb;
  v_legacy_extra jsonb;
  v_item jsonb;
  v_base_bill numeric := 0;
  v_base_sub numeric := 0;
  v_standard_bill numeric := 0;
  v_standard_sub numeric := 0;
  v_misc_bill numeric := 0;
  v_misc_sub numeric := 0;
  v_services_bill numeric := 0;
  v_services_sub numeric := 0;
  v_frozen_bill numeric := 0;
  v_frozen_sub numeric := 0;
  v_total_bill numeric := 0;
  v_total_sub numeric := 0;
  v_charges_approved boolean := false;
  v_latest_decision text;
  v_latest_invalidated_at timestamptz;
  v_has_decision_record boolean := false;
  v_source text := 'live_job_details';
BEGIN
  SELECT j.active_snapshot_id, j.historical_data_mode, j.total_billing_amount,
         j.cancellation_trip_charge_added, j.cancellation_trip_charge_bill_amount,
         j.cancellation_trip_charge_sub_pay_amount, jp.job_phase_label
  INTO v_job
  FROM public.jobs j
  LEFT JOIN public.job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  v_details := public.get_job_details(p_job_id);

  IF v_job.historical_data_mode = 'snapshot' AND v_job.active_snapshot_id IS NOT NULL THEN
    SELECT total_bill, total_sub_pay INTO v_snapshot
    FROM public.job_snapshots
    WHERE id = v_job.active_snapshot_id;

    IF FOUND THEN
      RETURN v_details || jsonb_build_object(
        'authoritative_billing_totals', jsonb_build_object(
          'total_bill', COALESCE(v_snapshot.total_bill, 0),
          'total_sub_pay', COALESCE(v_snapshot.total_sub_pay, 0),
          'charges_approved', true,
          'source', 'financial_snapshot'
        )
      );
    END IF;
  END IF;

  SELECT a.decision, a.invalidated_at, true
  INTO v_latest_decision, v_latest_invalidated_at, v_has_decision_record
  FROM public.approval_tokens a
  WHERE a.job_id = p_job_id
    AND a.approval_type = 'extra_charges'
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_has_decision_record THEN
    v_charges_approved := v_latest_decision = 'approved' AND v_latest_invalidated_at IS NULL;
  ELSE
    v_charges_approved := lower(COALESCE(v_job.job_phase_label, '')) SIMILAR TO '%(completed|quality control|invoicing|archived)%';
  END IF;

  IF COALESCE(v_job.cancellation_trip_charge_added, false) THEN
    v_total_bill := COALESCE(v_job.cancellation_trip_charge_bill_amount, 0);
    v_total_sub := COALESCE(v_job.cancellation_trip_charge_sub_pay_amount, 0);
    v_source := 'cancellation_trip_charge';
  ELSE
    v_work_order := COALESCE(v_details->'work_order', '{}'::jsonb);
    v_base := COALESCE(v_details->'billing_details', '{}'::jsonb);
    v_legacy_extra := COALESCE(v_details->'extra_charges_details', '{}'::jsonb);
    v_base_bill := public.report_numeric(COALESCE(v_base->>'bill_amount', v_base->>'base_price'));
    v_base_sub := public.report_numeric(v_base->>'sub_pay_amount');

    IF jsonb_typeof(v_work_order->'additional_services') = 'array' THEN
      FOR v_item IN SELECT value FROM jsonb_array_elements(v_work_order->'additional_services') LOOP
        v_services_bill := v_services_bill + public.report_numeric(COALESCE(v_item->>'amountBill', v_item->>'bill_amount'));
        v_services_sub := v_services_sub + public.report_numeric(COALESCE(v_item->>'amountSub', v_item->>'sub_pay_amount'));
      END LOOP;
    END IF;
    IF jsonb_typeof(v_work_order->'frozen_billing_lines') = 'array' THEN
      FOR v_item IN SELECT value FROM jsonb_array_elements(v_work_order->'frozen_billing_lines') LOOP
        v_frozen_bill := v_frozen_bill + public.report_numeric(COALESCE(v_item->>'amountBill', v_item->>'bill_amount'));
        v_frozen_sub := v_frozen_sub + public.report_numeric(COALESCE(v_item->>'amountSub', v_item->>'sub_pay_amount'));
      END LOOP;
    END IF;
    IF v_frozen_bill >= v_services_bill THEN
      v_services_bill := v_frozen_bill;
      v_services_sub := v_frozen_sub;
    END IF;

    IF v_charges_approved THEN
      IF jsonb_typeof(v_work_order->'extra_charges_line_items') = 'array'
         AND jsonb_array_length(v_work_order->'extra_charges_line_items') > 0 THEN
        FOR v_item IN SELECT value FROM jsonb_array_elements(v_work_order->'extra_charges_line_items') LOOP
          v_standard_bill := v_standard_bill + CASE
            WHEN v_item ? 'calculatedBillAmount' THEN public.report_numeric(v_item->>'calculatedBillAmount')
            ELSE public.report_numeric(v_item->>'quantity') * public.report_numeric(v_item->>'billRate')
          END;
          v_standard_sub := v_standard_sub + CASE
            WHEN v_item ? 'calculatedSubAmount' THEN public.report_numeric(v_item->>'calculatedSubAmount')
            ELSE public.report_numeric(v_item->>'quantity') * public.report_numeric(v_item->>'subRate')
          END;
        END LOOP;
      ELSE
        v_standard_bill := public.report_numeric(v_legacy_extra->>'bill_amount');
        v_standard_sub := public.report_numeric(v_legacy_extra->>'sub_pay_amount');
      END IF;

      IF jsonb_typeof(v_work_order->'misc_additional_cost_items') = 'array'
         AND jsonb_array_length(v_work_order->'misc_additional_cost_items') > 0 THEN
        FOR v_item IN SELECT value FROM jsonb_array_elements(v_work_order->'misc_additional_cost_items') LOOP
          v_misc_bill := v_misc_bill + public.report_numeric(COALESCE(v_item->>'price', v_item->>'billAmount'));
          v_misc_sub := v_misc_sub + public.report_numeric(COALESCE(v_item->>'subPay', v_item->>'subPayAmount'));
        END LOOP;
      ELSE
        v_misc_bill := public.report_numeric(COALESCE(v_details->>'repair_amount', v_work_order->>'repair_cost'));
        v_misc_sub := public.report_numeric(v_details->>'repair_sub_pay');
      END IF;
    END IF;

    v_total_bill := v_base_bill + v_services_bill + v_standard_bill + v_misc_bill;
    v_total_sub := v_base_sub + v_services_sub + v_standard_sub + v_misc_sub;
  END IF;

  RETURN v_details || jsonb_build_object(
    'authoritative_billing_totals', jsonb_build_object(
      'base_bill', round(v_base_bill, 2),
      'base_sub_pay', round(v_base_sub, 2),
      'standard_extra_bill', round(v_standard_bill, 2),
      'standard_extra_sub_pay', round(v_standard_sub, 2),
      'misc_bill', round(v_misc_bill, 2),
      'misc_sub_pay', round(v_misc_sub, 2),
      'total_bill', round(v_total_bill, 2),
      'total_sub_pay', round(v_total_sub, 2),
      'charges_approved', v_charges_approved,
      'source', v_source
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_job_details_with_billing_totals(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_job_details_with_billing_totals(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_job_details_with_billing_totals(uuid) IS
  'Returns the established Job Details payload with authoritative report totals. Frozen jobs use immutable snapshot totals; live extra and miscellaneous charges contribute only after approval.';
