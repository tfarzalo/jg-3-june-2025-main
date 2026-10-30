-- Canonical job billing calculator.
--
-- This migration intentionally performs no data updates and changes no RLS
-- policies. It centralizes the billing precedence used by Job Details,
-- reports, future cache synchronization, and future snapshot creation. It
-- does not invoke automatic snapshot creation; snapshot writes remain in the
-- established phase/snapshot workflow until that workflow is updated.

-- Fail before replacing any function if the live schema or snapshot state
-- cannot support an authoritative calculation. This block is read-only.
DO $$
DECLARE
  v_invalid_snapshot_jobs integer;
BEGIN
  IF to_regprocedure('public.get_job_details_live(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Required function public.get_job_details_live(uuid) is not installed';
  END IF;

  IF to_regprocedure('public.get_job_details(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Required function public.get_job_details(uuid) is not installed';
  END IF;

  IF to_regprocedure('public.decorate_job_payload_with_static_subcontractors(uuid,jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Required function public.decorate_job_payload_with_static_subcontractors(uuid,jsonb) is not installed';
  END IF;

  SELECT count(*)
  INTO v_invalid_snapshot_jobs
  FROM public.jobs AS j
  LEFT JOIN public.job_snapshots AS js
    ON js.id = j.active_snapshot_id
   AND js.job_id = j.id
  WHERE
    (j.historical_data_mode = 'snapshot' AND j.active_snapshot_id IS NULL)
    OR (j.active_snapshot_id IS NOT NULL
        AND j.historical_data_mode IS DISTINCT FROM 'snapshot')
    OR (j.active_snapshot_id IS NOT NULL AND js.id IS NULL);

  IF v_invalid_snapshot_jobs > 0 THEN
    RAISE EXCEPTION
      'Canonical billing migration stopped: % job(s) have inconsistent financial snapshot state',
      v_invalid_snapshot_jobs;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_numeric(p_value text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN btrim(COALESCE(p_value, '')) ~ '^-?[0-9]+([.][0-9]+)?$'
      THEN btrim(p_value)::numeric
    ELSE 0::numeric
  END;
$$;

COMMENT ON FUNCTION public.billing_numeric(text) IS
  'Converts a billing JSON text value to numeric without allowing malformed values to fail a read.';

REVOKE ALL ON FUNCTION public.billing_numeric(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_numeric(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_numeric(text) TO service_role;

CREATE OR REPLACE FUNCTION public.calculate_job_billing_totals(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  v_total_bill numeric := 0;
  v_total_sub numeric := 0;

  v_charges_approved boolean := false;
  v_latest_decision text;
  v_latest_invalidated_at timestamptz;
  v_has_decision_record boolean := false;
  v_source text := 'live_job_details';
  v_standard_source text := 'none';
  v_misc_source text := 'none';
  v_supplemental_source text := 'none';
  v_standard_validation text := 'missing';
  v_misc_validation text := 'missing';
  v_snapshot_validation text := 'not_applicable';
BEGIN
  SELECT
    j.active_snapshot_id,
    j.historical_data_mode,
    j.total_billing_amount,
    j.cancellation_trip_charge_added,
    j.cancellation_trip_charge_bill_amount,
    j.cancellation_trip_charge_sub_pay_amount,
    jp.job_phase_label
  INTO v_job
  FROM public.jobs AS j
  LEFT JOIN public.job_phases AS jp ON jp.id = j.current_phase_id
  WHERE j.id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF v_job.historical_data_mode = 'snapshot'
     OR v_job.active_snapshot_id IS NOT NULL THEN
    IF v_job.active_snapshot_id IS NULL THEN
      RAISE EXCEPTION
        'Snapshot-backed job % has no active financial snapshot reference',
        p_job_id;
    END IF;

    IF v_job.historical_data_mode IS DISTINCT FROM 'snapshot' THEN
      RAISE EXCEPTION
        'Job % has an active financial snapshot but is not in snapshot data mode',
        p_job_id;
    END IF;

    SELECT js.total_bill, js.total_sub_pay
    INTO v_snapshot
    FROM public.job_snapshots AS js
    WHERE js.id = v_job.active_snapshot_id
      AND js.job_id = p_job_id;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'base_bill', 0,
        'base_sub_pay', 0,
        'supplemental_bill', 0,
        'supplemental_sub_pay', 0,
        'standard_extra_bill', 0,
        'standard_extra_sub_pay', 0,
        'misc_bill', 0,
        'misc_sub_pay', 0,
        'total_bill', round(COALESCE(v_snapshot.total_bill, 0), 2),
        'total_sub_pay', round(COALESCE(v_snapshot.total_sub_pay, 0), 2),
        'cached_total_bill', round(COALESCE(v_job.total_billing_amount, 0), 2),
        'charges_approved', true,
        'source', 'financial_snapshot',
        'component_sources', jsonb_build_object(
          'standard_extras', 'financial_snapshot',
          'misc', 'financial_snapshot',
          'supplemental', 'financial_snapshot'
        ),
        'validation', jsonb_build_object(
          'snapshot', 'valid',
          'standard_extra_charges', 'snapshot',
          'misc_additional_cost_items', 'snapshot'
        )
      );
    END IF;

    -- A live recalculation is not a safe substitute for frozen financial
    -- history. Surface the integrity error instead of returning a plausible
    -- but historically inaccurate amount.
    RAISE EXCEPTION
      'Snapshot-backed job % has no matching active financial snapshot',
      p_job_id;
  END IF;

  SELECT a.decision, a.invalidated_at, true
  INTO v_latest_decision, v_latest_invalidated_at, v_has_decision_record
  FROM public.approval_tokens AS a
  WHERE a.job_id = p_job_id
    AND a.approval_type = 'extra_charges'
  ORDER BY a.created_at DESC, a.id DESC
  LIMIT 1;

  IF v_has_decision_record THEN
    v_charges_approved :=
      v_latest_decision = 'approved'
      AND v_latest_invalidated_at IS NULL;
  ELSE
    -- Preserve the established compatibility behavior for older jobs that
    -- reached a post-approval phase before permanent decision rows existed.
    v_charges_approved := lower(COALESCE(v_job.job_phase_label, ''))
      SIMILAR TO '%(completed|quality control|invoicing|archived)%';
  END IF;

  IF COALESCE(v_job.cancellation_trip_charge_added, false) THEN
    v_total_bill := COALESCE(v_job.cancellation_trip_charge_bill_amount, 0);
    v_total_sub := COALESCE(v_job.cancellation_trip_charge_sub_pay_amount, 0);
    v_source := 'cancellation_trip_charge';
    v_standard_source := 'not_applicable';
    v_misc_source := 'not_applicable';
    v_supplemental_source := 'not_applicable';
    v_standard_validation := 'not_applicable';
    v_misc_validation := 'not_applicable';
  ELSE
    -- Use the live payload function directly. The public get_job_details
    -- wrapper can create a missing terminal snapshot as a side effect, which
    -- is intentionally outside this calculation-only migration.
    v_details := public.get_job_details_live(p_job_id);
    v_work_order := COALESCE(v_details->'work_order', '{}'::jsonb);
    v_base := COALESCE(v_details->'billing_details', '{}'::jsonb);
    v_legacy_extra := COALESCE(v_details->'extra_charges_details', '{}'::jsonb);

    v_base_bill := public.billing_numeric(
      COALESCE(v_base->>'bill_amount', v_base->>'base_price')
    );
    v_base_sub := public.billing_numeric(v_base->>'sub_pay_amount');

    IF jsonb_typeof(v_work_order->'additional_services') = 'array' THEN
      FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(v_work_order->'additional_services')
      LOOP
        v_services_bill := v_services_bill + public.billing_numeric(
          COALESCE(v_item->>'amountBill', v_item->>'bill_amount')
        );
        v_services_sub := v_services_sub + public.billing_numeric(
          COALESCE(v_item->>'amountSub', v_item->>'sub_pay_amount')
        );
      END LOOP;
    END IF;

    -- Snapshot-backed jobs returned above use their frozen snapshot total.
    -- Live jobs use live additional services only; frozen and live
    -- representations are never compared or added together.
    v_supplemental_source := 'additional_services';

    IF jsonb_typeof(v_work_order->'extra_charges_line_items') = 'array' THEN
      v_standard_validation := 'array';
    ELSIF NOT (v_work_order ? 'extra_charges_line_items')
       OR v_work_order->'extra_charges_line_items' = 'null'::jsonb THEN
      v_standard_validation := 'missing';
    ELSE
      v_standard_validation := 'malformed';
    END IF;

    IF jsonb_typeof(v_work_order->'misc_additional_cost_items') = 'array' THEN
      v_misc_validation := 'array';
    ELSIF NOT (v_work_order ? 'misc_additional_cost_items')
       OR v_work_order->'misc_additional_cost_items' = 'null'::jsonb THEN
      v_misc_validation := 'missing';
    ELSE
      v_misc_validation := 'malformed';
    END IF;

    IF v_charges_approved THEN
      -- A nonempty structured standard-extra array replaces the legacy
      -- aggregate. Empty/missing arrays retain legacy compatibility for older
      -- jobs that predate structured standard line items.
      IF v_standard_validation = 'array'
         AND jsonb_array_length(v_work_order->'extra_charges_line_items') > 0 THEN
        v_standard_source := 'structured';
        FOR v_item IN
          SELECT value
          FROM jsonb_array_elements(v_work_order->'extra_charges_line_items')
        LOOP
          IF jsonb_typeof(v_item) <> 'object' THEN
            v_standard_validation := 'malformed';
            v_standard_source := 'invalid_structured_data';
            v_standard_bill := 0;
            v_standard_sub := 0;
            EXIT;
          END IF;

          v_standard_bill := v_standard_bill + CASE
            WHEN COALESCE(v_item->>'calculatedBillAmount', '')
                   ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN public.billing_numeric(v_item->>'calculatedBillAmount')
            ELSE public.billing_numeric(v_item->>'quantity')
              * public.billing_numeric(v_item->>'billRate')
          END;
          v_standard_sub := v_standard_sub + CASE
            WHEN COALESCE(v_item->>'calculatedSubAmount', '')
                   ~ '^-?[0-9]+([.][0-9]+)?$'
              THEN public.billing_numeric(v_item->>'calculatedSubAmount')
            ELSE public.billing_numeric(v_item->>'quantity')
              * public.billing_numeric(v_item->>'subRate')
          END;
        END LOOP;
      ELSIF v_standard_validation <> 'malformed' THEN
        v_standard_source := 'legacy_fallback';
        v_standard_bill := public.billing_numeric(v_legacy_extra->>'bill_amount');
        v_standard_sub := public.billing_numeric(v_legacy_extra->>'sub_pay_amount');
      ELSE
        v_standard_source := 'invalid_structured_data';
      END IF;

      -- Any structured miscellaneous array is authoritative. In particular,
      -- [] is an explicit zero and must suppress stale repair mirrors.
      IF v_misc_validation = 'array' THEN
        v_misc_source := 'structured';
        FOR v_item IN
          SELECT value
          FROM jsonb_array_elements(v_work_order->'misc_additional_cost_items')
        LOOP
          IF jsonb_typeof(v_item) <> 'object' THEN
            v_misc_validation := 'malformed';
            v_misc_source := 'invalid_structured_data';
            v_misc_bill := 0;
            v_misc_sub := 0;
            EXIT;
          END IF;

          v_misc_bill := v_misc_bill + public.billing_numeric(
            COALESCE(v_item->>'price', v_item->>'billAmount')
          );
          v_misc_sub := v_misc_sub + public.billing_numeric(
            COALESCE(v_item->>'subPay', v_item->>'subPayAmount')
          );
        END LOOP;
      ELSIF v_misc_validation = 'missing' THEN
        v_misc_source := 'legacy_fallback';
        v_misc_bill := public.billing_numeric(
          COALESCE(v_details->>'repair_amount', v_work_order->>'repair_cost')
        );
        v_misc_sub := public.billing_numeric(v_details->>'repair_sub_pay');
      ELSE
        v_misc_source := 'invalid_structured_data';
      END IF;
    ELSE
      v_standard_source := 'excluded_pending_approval';
      v_misc_source := 'excluded_pending_approval';
    END IF;

    v_total_bill := v_base_bill + v_services_bill + v_standard_bill + v_misc_bill;
    v_total_sub := v_base_sub + v_services_sub + v_standard_sub + v_misc_sub;
  END IF;

  RETURN jsonb_build_object(
    'base_bill', round(v_base_bill, 2),
    'base_sub_pay', round(v_base_sub, 2),
    'supplemental_bill', round(v_services_bill, 2),
    'supplemental_sub_pay', round(v_services_sub, 2),
    'standard_extra_bill', round(v_standard_bill, 2),
    'standard_extra_sub_pay', round(v_standard_sub, 2),
    'misc_bill', round(v_misc_bill, 2),
    'misc_sub_pay', round(v_misc_sub, 2),
    'total_bill', round(v_total_bill, 2),
    'total_sub_pay', round(v_total_sub, 2),
    'cached_total_bill', round(COALESCE(v_job.total_billing_amount, 0), 2),
    'charges_approved', v_charges_approved,
    'source', v_source,
    'component_sources', jsonb_build_object(
      'standard_extras', v_standard_source,
      'misc', v_misc_source,
      'supplemental', v_supplemental_source
    ),
    'validation', jsonb_build_object(
      'snapshot', v_snapshot_validation,
      'standard_extra_charges', v_standard_validation,
      'misc_additional_cost_items', v_misc_validation
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_job_billing_totals(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_job_billing_totals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_job_billing_totals(uuid) TO service_role;

COMMENT ON FUNCTION public.calculate_job_billing_totals(uuid) IS
  'Canonical job billing calculation. Structured misc arrays, including [], replace legacy repair mirrors; nonempty structured standard extras replace their legacy aggregate; snapshots remain authoritative.';

CREATE OR REPLACE FUNCTION public.get_job_details_with_billing_totals(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_details jsonb;
  v_totals jsonb;
BEGIN
  v_totals := public.calculate_job_billing_totals(p_job_id);

  IF v_totals->>'source' = 'financial_snapshot' THEN
    -- calculate_job_billing_totals already verified that this exact snapshot
    -- exists, so this read cannot enter get_job_details' missing-snapshot
    -- creation branch.
    v_details := public.get_job_details(p_job_id);
  ELSE
    v_details := public.decorate_job_payload_with_static_subcontractors(
      p_job_id,
      public.get_job_details_live(p_job_id)
    ) || jsonb_build_object(
      'historical_data_mode', 'live',
      'active_snapshot_id', NULL,
      'snapshot_frozen_at', NULL,
      'snapshot_phase_label', NULL
    );
  END IF;

  RETURN v_details || jsonb_build_object(
    'authoritative_billing_totals', v_totals,
    'billing_validation', COALESCE(v_totals->'validation', '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_job_details_with_billing_totals(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_job_details_with_billing_totals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_job_details_with_billing_totals(uuid) TO service_role;

COMMENT ON FUNCTION public.get_job_details_with_billing_totals(uuid) IS
  'Returns the established Job Details payload plus the canonical billing calculation and validation metadata.';
