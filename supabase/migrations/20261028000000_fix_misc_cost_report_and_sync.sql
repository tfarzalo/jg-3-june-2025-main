-- Treat a structured miscellaneous-cost array as authoritative, including [].
-- Keep the structured and legacy columns synchronized for future work-order edits,
-- and repair the single known orphaned legacy value on WO-010918.

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

      -- An array is an explicit structured value. Iterating [] intentionally
      -- contributes zero; legacy fallback is reserved for absent/null data.
      IF jsonb_typeof(v_work_order->'misc_additional_cost_items') = 'array' THEN
        FOR v_item IN SELECT value FROM jsonb_array_elements(v_work_order->'misc_additional_cost_items') LOOP
          v_misc_bill := v_misc_bill + public.report_numeric(COALESCE(v_item->>'price', v_item->>'billAmount'));
          v_misc_sub := v_misc_sub + public.report_numeric(COALESCE(v_item->>'subPay', v_item->>'subPayAmount'));
        END LOOP;
      ELSIF NOT (v_work_order ? 'misc_additional_cost_items')
         OR v_work_order->'misc_additional_cost_items' = 'null'::jsonb THEN
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
  'Returns authoritative report totals. Structured miscellaneous-cost arrays, including empty arrays, take precedence over legacy repair fields.';

CREATE OR REPLACE FUNCTION public.sync_job_misc_costs_from_work_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_bill numeric := 0;
  v_sub_pay numeric := 0;
  v_description text := '';
  v_price_text text;
  v_sub_pay_text text;
BEGIN
  IF jsonb_typeof(NEW.misc_additional_cost_items) <> 'array' THEN
    RAISE EXCEPTION 'Miscellaneous additional cost items must be a JSON array';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.misc_additional_cost_items)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Each miscellaneous additional cost item must be an object';
    END IF;

    v_price_text := COALESCE(v_item->>'price', v_item->>'billAmount', '0');
    v_sub_pay_text := COALESCE(v_item->>'subPay', v_item->>'subPayAmount', '0');
    IF v_price_text !~ '^[0-9]+([.][0-9]+)?$'
       OR v_sub_pay_text !~ '^[0-9]+([.][0-9]+)?$' THEN
      RAISE EXCEPTION 'Miscellaneous additional cost amounts must be non-negative numbers';
    END IF;

    v_bill := v_bill + v_price_text::numeric;
    v_sub_pay := v_sub_pay + v_sub_pay_text::numeric;
    IF btrim(COALESCE(v_item->>'description', '')) <> '' THEN
      v_description := concat_ws('; ', NULLIF(v_description, ''), btrim(v_item->>'description'));
    END IF;
  END LOOP;

  NEW.repair_cost := round(v_bill, 2);
  NEW.repair_description := NULLIF(v_description, '');

  UPDATE public.jobs
  SET repair_amount = round(v_bill, 2),
      repair_sub_pay = round(v_sub_pay, 2)
  WHERE id = NEW.job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matching job was not found';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_job_misc_costs_from_work_order() FROM PUBLIC;

DROP TRIGGER IF EXISTS sync_job_misc_costs_from_work_order_trigger ON public.work_orders;
CREATE TRIGGER sync_job_misc_costs_from_work_order_trigger
BEFORE INSERT OR UPDATE OF misc_additional_cost_items ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_job_misc_costs_from_work_order();

COMMENT ON FUNCTION public.sync_job_misc_costs_from_work_order() IS
  'Atomically synchronizes structured work-order miscellaneous costs to work-order legacy fields and job billing fields.';

-- Preserve the existing RPC contract while letting the trigger perform the
-- single jobs update. This avoids duplicate job audit/reapproval events.
CREATE OR REPLACE FUNCTION public.save_misc_additional_costs(
  p_job_id uuid,
  p_work_order_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_bill numeric := 0;
  v_sub_pay numeric := 0;
  v_work_order_id uuid;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Miscellaneous additional cost items must be a JSON array';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Each miscellaneous additional cost item must be an object';
    END IF;
    IF COALESCE(v_item->>'price', '') !~ '^[0-9]+([.][0-9]+)?$'
       OR (v_item->>'subPay' IS NOT NULL AND v_item->>'subPay' !~ '^[0-9]+([.][0-9]+)?$') THEN
      RAISE EXCEPTION 'Miscellaneous additional cost amounts must be non-negative numbers';
    END IF;

    v_bill := v_bill + (v_item->>'price')::numeric;
    v_sub_pay := v_sub_pay + COALESCE((v_item->>'subPay')::numeric, 0);
  END LOOP;

  UPDATE public.work_orders
  SET misc_additional_cost_items = p_items
  WHERE id = p_work_order_id
    AND job_id = p_job_id
  RETURNING id INTO v_work_order_id;

  IF v_work_order_id IS NULL THEN
    RAISE EXCEPTION 'Matching work order was not found or is not editable';
  END IF;

  RETURN jsonb_build_object(
    'job_id', p_job_id,
    'work_order_id', p_work_order_id,
    'item_count', jsonb_array_length(p_items),
    'bill_total', round(v_bill, 2),
    'sub_pay_total', round(v_sub_pay, 2)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_misc_additional_costs(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_misc_additional_costs(uuid, uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.save_misc_additional_costs(uuid, uuid, jsonb) IS
  'Atomically saves miscellaneous costs through the work-order synchronization trigger. An empty array explicitly clears related amounts.';

-- Narrow, idempotent repair for the known orphan. The guards prevent this from
-- touching the row if its billing state no longer matches the investigated case.
UPDATE public.jobs AS j
SET repair_sub_pay = 0
WHERE j.work_order_num = 10918
  AND COALESCE(j.repair_amount, 0) = 0
  AND j.repair_sub_pay = 40
  AND EXISTS (
    SELECT 1
    FROM public.work_orders AS wo
    WHERE wo.job_id = j.id
      AND jsonb_typeof(wo.misc_additional_cost_items) = 'array'
      AND jsonb_array_length(wo.misc_additional_cost_items) = 0
  );
