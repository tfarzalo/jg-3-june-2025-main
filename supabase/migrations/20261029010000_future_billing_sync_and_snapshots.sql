-- Keep future live billing mirrors, cached totals, and new financial snapshots
-- aligned with the canonical calculator installed by 20261029000000.
--
-- This migration changes future write behavior only. It contains no bulk
-- reconciliation or historical-data backfill; existing-row repair belongs in
-- the separately reviewed data-repair migration.

BEGIN;

DO $$
DECLARE
  v_duplicate_active_work_orders integer;
  v_unresolved_supplemental_references integer;
  v_inconsistent_live_cancellations integer;
  v_malformed_structured_billing integer;
BEGIN
  IF to_regprocedure('public.calculate_job_billing_totals(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Run canonical billing calculator migration 20261029000000 first';
  END IF;

  IF to_regprocedure('public.get_job_details_live(uuid)') IS NULL
     OR to_regprocedure('public.build_work_order_frozen_billing_lines(uuid)') IS NULL
     OR to_regprocedure('public.is_terminal_job_phase(text)') IS NULL THEN
    RAISE EXCEPTION 'Required job snapshot functions are not installed';
  END IF;

  SELECT count(*)
  INTO v_duplicate_active_work_orders
  FROM (
    SELECT wo.job_id
    FROM public.work_orders AS wo
    WHERE wo.is_active IS TRUE
    GROUP BY wo.job_id
    HAVING count(*) > 1
  ) AS duplicates;

  IF v_duplicate_active_work_orders > 0 THEN
    RAISE EXCEPTION
      'Future billing synchronization stopped: % job(s) have multiple active work orders',
      v_duplicate_active_work_orders;
  END IF;

  SELECT count(*)
  INTO v_unresolved_supplemental_references
  FROM public.work_orders AS wo
  JOIN public.jobs AS j ON j.id = wo.job_id
  WHERE wo.is_active IS TRUE
    AND COALESCE(j.historical_data_mode, 'live') = 'live'
    AND j.active_snapshot_id IS NULL
    AND (
      (
        wo.painted_ceilings IS TRUE
        AND (
          wo.ceiling_billing_detail_id IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM public.billing_details AS bd
            WHERE bd.id = wo.ceiling_billing_detail_id
              AND bd.property_id = j.property_id
          )
        )
      )
      OR (
        wo.has_accent_wall IS TRUE
        AND (
          wo.accent_wall_billing_detail_id IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM public.billing_details AS bd
            WHERE bd.id = wo.accent_wall_billing_detail_id
              AND bd.property_id = j.property_id
          )
        )
      )
      OR EXISTS (
        SELECT 1
        FROM jsonb_each(
          CASE
            WHEN jsonb_typeof(wo.additional_services) = 'object'
              THEN wo.additional_services
            ELSE '{}'::jsonb
          END
        ) AS svc(service_key, service_value)
        WHERE
          (
            jsonb_typeof(svc.service_value) = 'object'
            AND (
              COALESCE(svc.service_value->>'billing_detail_id', '') = ''
              OR NOT EXISTS (
                SELECT 1
                FROM public.billing_details AS bd
                WHERE bd.id::text = svc.service_value->>'billing_detail_id'
                  AND bd.property_id = j.property_id
              )
              OR (
                svc.service_value ? 'quantity'
                AND COALESCE(svc.service_value->>'quantity', '')
                      !~ '^[0-9]+([.][0-9]+)?$'
              )
            )
          )
          OR (
            jsonb_typeof(svc.service_value) = 'boolean'
            AND svc.service_value = 'true'::jsonb
          )
          OR jsonb_typeof(svc.service_value) NOT IN ('object', 'boolean')
      )
    );

  IF v_unresolved_supplemental_references > 0 THEN
    RAISE EXCEPTION
      'Future billing synchronization stopped: % active live work order(s) have unresolved supplemental billing references',
      v_unresolved_supplemental_references;
  END IF;

  SELECT count(*)
  INTO v_malformed_structured_billing
  FROM public.work_orders AS wo
  JOIN public.jobs AS j ON j.id = wo.job_id
  WHERE wo.is_active IS TRUE
    AND COALESCE(j.historical_data_mode, 'live') = 'live'
    AND j.active_snapshot_id IS NULL
    AND (
      (
        wo.extra_charges_line_items IS NOT NULL
        AND (
          jsonb_typeof(wo.extra_charges_line_items) <> 'array'
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(wo.extra_charges_line_items) = 'array'
                THEN wo.extra_charges_line_items ELSE '[]'::jsonb END
            ) AS item(value)
            WHERE jsonb_typeof(item.value) <> 'object'
              OR COALESCE(item.value->>'quantity', '') !~ '^[0-9]+([.][0-9]+)?$'
              OR COALESCE(item.value->>'billRate', '') !~ '^[0-9]+([.][0-9]+)?$'
              OR COALESCE(item.value->>'subRate', '') !~ '^[0-9]+([.][0-9]+)?$'
              OR (item.value ? 'calculatedBillAmount'
                  AND COALESCE(item.value->>'calculatedBillAmount', '') !~ '^[0-9]+([.][0-9]+)?$')
              OR (item.value ? 'calculatedSubAmount'
                  AND COALESCE(item.value->>'calculatedSubAmount', '') !~ '^[0-9]+([.][0-9]+)?$')
              OR (
                lower(COALESCE(item.value->>'isHourly', 'false')) IN ('true', 't', '1', 'yes')
                AND lower(COALESCE(item.value->>'customizeHours', 'false')) IN ('true', 't', '1', 'yes')
                AND (
                  COALESCE(item.value->>'billHours', '') !~ '^[0-9]+([.][0-9]+)?$'
                  OR COALESCE(item.value->>'subPayHours', '') !~ '^[0-9]+([.][0-9]+)?$'
                )
              )
          )
        )
      )
      OR
      (
        wo.misc_additional_cost_items IS NOT NULL
        AND (
          jsonb_typeof(wo.misc_additional_cost_items) <> 'array'
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(wo.misc_additional_cost_items) = 'array'
                THEN wo.misc_additional_cost_items ELSE '[]'::jsonb END
            ) AS item(value)
            WHERE jsonb_typeof(item.value) <> 'object'
              OR COALESCE(item.value->>'price', item.value->>'billAmount', '')
                    !~ '^[0-9]+([.][0-9]+)?$'
              OR (COALESCE(item.value->>'subPay', item.value->>'subPayAmount') IS NOT NULL
                  AND COALESCE(item.value->>'subPay', item.value->>'subPayAmount', '')
                        !~ '^[0-9]+([.][0-9]+)?$')
          )
        )
      )
    );

  IF v_malformed_structured_billing > 0 THEN
    RAISE EXCEPTION
      'Future billing synchronization stopped: % active live work order(s) have malformed structured billing values',
      v_malformed_structured_billing;
  END IF;

  SELECT count(*)
  INTO v_inconsistent_live_cancellations
  FROM public.jobs AS j
  LEFT JOIN public.job_phases AS jp ON jp.id = j.current_phase_id
  WHERE COALESCE(j.historical_data_mode, 'live') = 'live'
    AND j.active_snapshot_id IS NULL
    AND COALESCE(j.cancellation_trip_charge_added, false) IS TRUE
    AND COALESCE(jp.job_phase_label, '') <> 'Cancelled';

  IF v_inconsistent_live_cancellations > 0 THEN
    RAISE EXCEPTION
      'Future billing synchronization stopped: % live non-cancelled job(s) still have cancellation trip-charge state',
      v_inconsistent_live_cancellations;
  END IF;
END;
$$;

-- Billing, snapshots, and job-detail reads all require one canonical active
-- work order. The preflight proves current rows are clean; the index preserves
-- that invariant under concurrent or future writes.
CREATE UNIQUE INDEX IF NOT EXISTS work_orders_one_active_per_job_idx
ON public.work_orders (job_id)
WHERE is_active IS TRUE;

-- Migration 1 preserved the older assumption that live additional_services
-- might already be an array of calculated lines. The stored column is an
-- object of selections. Resolve ceilings, accent walls, and dynamic services
-- through the established billing-detail builder, then replace (never add to)
-- the Migration 1 supplemental component.
CREATE OR REPLACE FUNCTION public.calculate_job_billing_totals_resolved(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_totals jsonb;
  v_details jsonb;
  v_work_order_id uuid;
  v_live_lines jsonb := '[]'::jsonb;
  v_old_supplemental_bill numeric := 0;
  v_old_supplemental_sub numeric := 0;
  v_live_supplemental_bill numeric := 0;
  v_live_supplemental_sub numeric := 0;
  v_total_bill numeric := 0;
  v_total_sub numeric := 0;
  v_phase_label text;
  v_invalid_supplemental_reference boolean := false;
  v_invalid_structured_billing boolean := false;
BEGIN
  v_totals := public.calculate_job_billing_totals(p_job_id);

  IF v_totals->>'source' = 'financial_snapshot' THEN
    RETURN v_totals;
  END IF;

  SELECT jp.job_phase_label
  INTO v_phase_label
  FROM public.jobs AS j
  LEFT JOIN public.job_phases AS jp ON jp.id = j.current_phase_id
  WHERE j.id = p_job_id;

  -- Cancellation is phase-driven. A cancelled job with no explicitly added
  -- trip charge is zero, not the otherwise-calculable live job amount.
  IF v_phase_label = 'Cancelled' THEN
    IF v_totals->>'source' = 'cancellation_trip_charge' THEN
      RETURN v_totals;
    END IF;

    RETURN v_totals || jsonb_build_object(
      'base_bill', 0,
      'base_sub_pay', 0,
      'supplemental_bill', 0,
      'supplemental_sub_pay', 0,
      'standard_extra_bill', 0,
      'standard_extra_sub_pay', 0,
      'misc_bill', 0,
      'misc_sub_pay', 0,
      'total_bill', 0,
      'total_sub_pay', 0,
      'source', 'cancellation_trip_charge',
      'component_sources', jsonb_build_object(
        'standard_extras', 'not_applicable',
        'misc', 'not_applicable',
        'supplemental', 'not_applicable'
      ),
      'validation', jsonb_build_object(
        'snapshot', 'not_applicable',
        'standard_extra_charges', 'not_applicable',
        'misc_additional_cost_items', 'not_applicable'
      )
    );
  END IF;

  IF v_totals->>'source' = 'cancellation_trip_charge' THEN
    RAISE EXCEPTION
      'Live non-cancelled job % has cancellation trip-charge state',
      p_job_id;
  END IF;

  v_details := public.get_job_details_live(p_job_id);
  v_work_order_id := NULLIF(v_details->'work_order'->>'id', '')::uuid;

  IF v_work_order_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.work_orders AS wo
      JOIN public.jobs AS j ON j.id = wo.job_id
      WHERE wo.id = v_work_order_id
        AND (
          (wo.painted_ceilings IS TRUE AND NOT EXISTS (
            SELECT 1 FROM public.billing_details AS bd
            WHERE bd.id = wo.ceiling_billing_detail_id
              AND bd.property_id = j.property_id
          ))
          OR
          (wo.has_accent_wall IS TRUE AND NOT EXISTS (
            SELECT 1 FROM public.billing_details AS bd
            WHERE bd.id = wo.accent_wall_billing_detail_id
              AND bd.property_id = j.property_id
          ))
        )
    ) INTO v_invalid_supplemental_reference;

    IF NOT v_invalid_supplemental_reference THEN
      SELECT EXISTS (
      SELECT 1
      FROM public.work_orders AS wo
      JOIN public.jobs AS j ON j.id = wo.job_id
      CROSS JOIN LATERAL jsonb_each(
        CASE WHEN jsonb_typeof(wo.additional_services) = 'object'
          THEN wo.additional_services ELSE '{}'::jsonb END
      ) AS svc(service_key, service_value)
      WHERE wo.id = v_work_order_id
        AND (
          (jsonb_typeof(svc.service_value) = 'boolean' AND svc.service_value = 'true'::jsonb)
          OR (
            jsonb_typeof(svc.service_value) = 'object'
            AND (
              COALESCE(svc.service_value->>'billing_detail_id', '') = ''
              OR NOT EXISTS (
                SELECT 1 FROM public.billing_details AS bd
                WHERE bd.id::text = svc.service_value->>'billing_detail_id'
                  AND bd.property_id = j.property_id
              )
              OR (
                svc.service_value ? 'quantity'
                AND COALESCE(svc.service_value->>'quantity', '')
                      !~ '^[0-9]+([.][0-9]+)?$'
              )
            )
          )
          OR jsonb_typeof(svc.service_value) NOT IN ('object', 'boolean')
        )
      ) INTO v_invalid_supplemental_reference;
    END IF;

    IF v_invalid_supplemental_reference THEN
      RAISE EXCEPTION
        'Active work order % has an unresolved supplemental billing reference',
        v_work_order_id;
    END IF;

    SELECT (
      (
        wo.extra_charges_line_items IS NOT NULL
        AND (
          jsonb_typeof(wo.extra_charges_line_items) <> 'array'
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(wo.extra_charges_line_items) = 'array'
                THEN wo.extra_charges_line_items ELSE '[]'::jsonb END
            ) AS item(value)
            WHERE jsonb_typeof(item.value) <> 'object'
              OR COALESCE(item.value->>'quantity', '') !~ '^[0-9]+([.][0-9]+)?$'
              OR COALESCE(item.value->>'billRate', '') !~ '^[0-9]+([.][0-9]+)?$'
              OR COALESCE(item.value->>'subRate', '') !~ '^[0-9]+([.][0-9]+)?$'
              OR (item.value ? 'calculatedBillAmount'
                  AND COALESCE(item.value->>'calculatedBillAmount', '') !~ '^[0-9]+([.][0-9]+)?$')
              OR (item.value ? 'calculatedSubAmount'
                  AND COALESCE(item.value->>'calculatedSubAmount', '') !~ '^[0-9]+([.][0-9]+)?$')
              OR (
                lower(COALESCE(item.value->>'isHourly', 'false')) IN ('true', 't', '1', 'yes')
                AND lower(COALESCE(item.value->>'customizeHours', 'false')) IN ('true', 't', '1', 'yes')
                AND (
                  COALESCE(item.value->>'billHours', '') !~ '^[0-9]+([.][0-9]+)?$'
                  OR COALESCE(item.value->>'subPayHours', '') !~ '^[0-9]+([.][0-9]+)?$'
                )
              )
          )
        )
      )
      OR
      (
        wo.misc_additional_cost_items IS NOT NULL
        AND (
          jsonb_typeof(wo.misc_additional_cost_items) <> 'array'
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(wo.misc_additional_cost_items) = 'array'
                THEN wo.misc_additional_cost_items ELSE '[]'::jsonb END
            ) AS item(value)
            WHERE jsonb_typeof(item.value) <> 'object'
              OR COALESCE(item.value->>'price', item.value->>'billAmount', '')
                    !~ '^[0-9]+([.][0-9]+)?$'
              OR (COALESCE(item.value->>'subPay', item.value->>'subPayAmount') IS NOT NULL
                  AND COALESCE(item.value->>'subPay', item.value->>'subPayAmount', '')
                        !~ '^[0-9]+([.][0-9]+)?$')
          )
        )
      )
    )
    INTO v_invalid_structured_billing
    FROM public.work_orders AS wo
    WHERE wo.id = v_work_order_id;

    IF v_invalid_structured_billing THEN
      RAISE EXCEPTION
        'Active work order % has malformed structured billing values',
        v_work_order_id;
    END IF;

    v_live_lines := public.build_work_order_frozen_billing_lines(v_work_order_id);
  END IF;

  SELECT
    COALESCE(sum(public.billing_numeric(line.value->>'amountBill')), 0),
    COALESCE(sum(public.billing_numeric(line.value->>'amountSub')), 0)
  INTO v_live_supplemental_bill, v_live_supplemental_sub
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(v_live_lines) = 'array' THEN v_live_lines
      ELSE '[]'::jsonb
    END
  ) AS line(value);

  v_old_supplemental_bill := public.billing_numeric(v_totals->>'supplemental_bill');
  v_old_supplemental_sub := public.billing_numeric(v_totals->>'supplemental_sub_pay');
  v_total_bill := public.billing_numeric(v_totals->>'total_bill')
    - v_old_supplemental_bill
    + v_live_supplemental_bill;
  v_total_sub := public.billing_numeric(v_totals->>'total_sub_pay')
    - v_old_supplemental_sub
    + v_live_supplemental_sub;

  RETURN jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            v_totals,
            '{supplemental_bill}',
            to_jsonb(round(v_live_supplemental_bill, 2)),
            true
          ),
          '{supplemental_sub_pay}',
          to_jsonb(round(v_live_supplemental_sub, 2)),
          true
        ),
        '{total_bill}',
        to_jsonb(round(v_total_bill, 2)),
        true
      ),
      '{total_sub_pay}',
      to_jsonb(round(v_total_sub, 2)),
      true
    ),
    '{component_sources,supplemental}',
    to_jsonb('live_billing_details'::text),
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_job_billing_totals_resolved(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_job_billing_totals_resolved(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_job_billing_totals_resolved(uuid) TO service_role;

COMMENT ON FUNCTION public.calculate_job_billing_totals_resolved(uuid) IS
  'Canonical totals with live ceilings, accent walls, and object-shaped dynamic additional services resolved through current billing details.';

-- The Migration 1 helper remains an implementation detail for the resolved
-- calculator. Prevent callers from accidentally using its incomplete live
-- supplemental interpretation directly.
REVOKE ALL ON FUNCTION public.calculate_job_billing_totals(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_job_billing_totals(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.calculate_job_billing_totals(uuid) FROM service_role;

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
  v_totals := public.calculate_job_billing_totals_resolved(p_job_id);

  IF v_totals->>'source' = 'financial_snapshot' THEN
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

-- The work-order trigger normalizes only work-order legacy mirrors. It must not
-- update jobs during a subcontractor's initial work-order submission.
CREATE OR REPLACE FUNCTION public.sync_job_misc_costs_from_work_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_bill numeric := 0;
  v_description text := '';
  v_price_text text;
BEGIN
  IF jsonb_typeof(NEW.misc_additional_cost_items) <> 'array' THEN
    RAISE EXCEPTION 'Miscellaneous additional cost items must be a JSON array';
  END IF;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(NEW.misc_additional_cost_items)
  LOOP
    IF jsonb_typeof(v_item) <> 'object' THEN
      RAISE EXCEPTION 'Each miscellaneous additional cost item must be an object';
    END IF;

    v_price_text := COALESCE(v_item->>'price', v_item->>'billAmount', '0');
    IF v_price_text !~ '^[0-9]+([.][0-9]+)?$' THEN
      RAISE EXCEPTION 'Miscellaneous additional cost bill amounts must be non-negative numbers';
    END IF;

    IF COALESCE(v_item->>'subPay', v_item->>'subPayAmount') IS NOT NULL
       AND COALESCE(v_item->>'subPay', v_item->>'subPayAmount', '')
             !~ '^[0-9]+([.][0-9]+)?$' THEN
      RAISE EXCEPTION 'Miscellaneous additional cost subcontractor amounts must be non-negative numbers';
    END IF;

    v_bill := v_bill + v_price_text::numeric;
    IF btrim(COALESCE(v_item->>'description', '')) <> '' THEN
      v_description := concat_ws(
        '; ',
        NULLIF(v_description, ''),
        btrim(v_item->>'description')
      );
    END IF;
  END LOOP;

  NEW.repair_cost := round(v_bill, 2);
  NEW.repair_description := COALESCE(NULLIF(v_description, ''), '');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_job_misc_costs_from_work_order() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_job_misc_costs_from_work_order() FROM authenticated;
REVOKE ALL ON FUNCTION public.sync_job_misc_costs_from_work_order() FROM service_role;

DROP TRIGGER IF EXISTS sync_job_misc_costs_from_work_order_trigger
  ON public.work_orders;
CREATE TRIGGER sync_job_misc_costs_from_work_order_trigger
BEFORE INSERT OR UPDATE OF misc_additional_cost_items
ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_job_misc_costs_from_work_order();

COMMENT ON FUNCTION public.sync_job_misc_costs_from_work_order() IS
  'Trigger-only normalization of structured miscellaneous costs into non-null work-order legacy fields; does not mutate jobs.';

-- Refresh only a mutable/live job cache. Snapshot-backed jobs remain immutable.
CREATE OR REPLACE FUNCTION public.refresh_live_job_billing_total(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_totals jsonb;
  v_total_bill numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.jobs AS j
    WHERE j.id = p_job_id
      AND COALESCE(j.historical_data_mode, 'live') = 'live'
      AND j.active_snapshot_id IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  v_totals := public.calculate_job_billing_totals_resolved(p_job_id);
  v_total_bill := public.billing_numeric(v_totals->>'total_bill');

  UPDATE public.jobs
  SET total_billing_amount = round(v_total_bill, 2)
  WHERE id = p_job_id
    AND total_billing_amount IS DISTINCT FROM round(v_total_bill, 2);

  RETURN v_totals;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_live_job_billing_total(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_live_job_billing_total(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_live_job_billing_total(uuid) TO service_role;

COMMENT ON FUNCTION public.refresh_live_job_billing_total(uuid) IS
  'Recalculates the cached customer billing total for one live job using the canonical calculator; snapshot-backed jobs are skipped.';

-- Keep phase-only reopen calls from older deployed clients safe during the
-- application rollout. The preferred RPC already performs these changes; this
-- trigger makes the same snapshot/live transition when an older client only
-- updates current_phase_id.
CREATE OR REPLACE FUNCTION public.guard_terminal_job_reopen()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_phase_label text;
  v_new_phase_label text;
BEGIN
  SELECT job_phase_label INTO v_old_phase_label
  FROM public.job_phases WHERE id = OLD.current_phase_id;

  SELECT job_phase_label INTO v_new_phase_label
  FROM public.job_phases WHERE id = NEW.current_phase_id;

  IF public.is_terminal_job_phase(v_old_phase_label)
     AND NOT public.is_terminal_job_phase(v_new_phase_label) THEN
    IF OLD.active_snapshot_id IS NOT NULL
       AND NEW.active_snapshot_id IS NOT NULL THEN
      UPDATE public.job_snapshots
      SET is_current = false,
          reopened_at = COALESCE(reopened_at, now()),
          reopened_by = COALESCE(reopened_by, auth.uid()),
          reopen_reason = COALESCE(reopen_reason, 'Phase-only terminal job reopen'),
          updated_at = now()
      WHERE id = OLD.active_snapshot_id
        AND job_id = OLD.id;

      NEW.active_snapshot_id := NULL;
      NEW.historical_data_mode := 'live';
      NEW.snapshot_last_phase_label := v_old_phase_label;
    END IF;

    IF v_old_phase_label = 'Cancelled' THEN
      NEW.cancellation_trip_charge_added := false;
      NEW.cancellation_trip_charge_bill_amount := 0;
      NEW.cancellation_trip_charge_sub_pay_amount := 0;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_terminal_job_reopen() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_terminal_job_reopen() FROM authenticated;
REVOKE ALL ON FUNCTION public.guard_terminal_job_reopen() FROM service_role;

DROP TRIGGER IF EXISTS guard_terminal_job_reopen_trigger ON public.jobs;
CREATE TRIGGER guard_terminal_job_reopen_trigger
BEFORE UPDATE OF current_phase_id ON public.jobs
FOR EACH ROW
WHEN (OLD.current_phase_id IS DISTINCT FROM NEW.current_phase_id)
EXECUTE FUNCTION public.guard_terminal_job_reopen();

CREATE OR REPLACE FUNCTION public.save_misc_additional_costs(
  p_job_id uuid,
  p_work_order_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_bill numeric := 0;
  v_sub_pay numeric := 0;
  v_work_order_id uuid;
  v_totals jsonb;
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
       OR (v_item->>'subPay' IS NOT NULL
           AND v_item->>'subPay' !~ '^[0-9]+([.][0-9]+)?$') THEN
      RAISE EXCEPTION 'Miscellaneous additional cost amounts must be non-negative numbers';
    END IF;

    v_bill := v_bill + (v_item->>'price')::numeric;
    v_sub_pay := v_sub_pay + COALESCE((v_item->>'subPay')::numeric, 0);
  END LOOP;

  -- The active-work-order and live-mode guards prevent accidental edits to a
  -- historical or superseded work order while preserving the existing RPC
  -- parameters used by Job Details.
  UPDATE public.work_orders AS wo
  SET misc_additional_cost_items = p_items
  FROM public.jobs AS j
  WHERE wo.id = p_work_order_id
    AND wo.job_id = p_job_id
    AND wo.job_id = j.id
    AND wo.is_active IS TRUE
    AND COALESCE(j.historical_data_mode, 'live') = 'live'
    AND j.active_snapshot_id IS NULL
  RETURNING wo.id INTO v_work_order_id;

  IF v_work_order_id IS NULL THEN
    RAISE EXCEPTION 'Matching active live work order was not found or is not editable';
  END IF;

  UPDATE public.jobs
  SET repair_amount = round(v_bill, 2),
      repair_sub_pay = round(v_sub_pay, 2)
  WHERE id = p_job_id
    AND (
      repair_amount IS DISTINCT FROM round(v_bill, 2)
      OR repair_sub_pay IS DISTINCT FROM round(v_sub_pay, 2)
    );

  v_totals := public.refresh_live_job_billing_total(p_job_id);

  RETURN jsonb_build_object(
    'job_id', p_job_id,
    'work_order_id', p_work_order_id,
    'item_count', jsonb_array_length(p_items),
    'bill_total', round(v_bill, 2),
    'sub_pay_total', round(v_sub_pay, 2),
    'total_bill', public.billing_numeric(v_totals->>'total_bill'),
    'total_sub_pay', public.billing_numeric(v_totals->>'total_sub_pay')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_misc_additional_costs(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_misc_additional_costs(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_misc_additional_costs(uuid, uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.save_misc_additional_costs(uuid, uuid, jsonb) IS
  'Atomically saves reviewed structured miscellaneous costs, synchronizes live job mirrors, and refreshes the canonical cached total. [] explicitly clears related amounts.';

-- Refresh the live cache after direct structured extra/supplemental edits.
CREATE OR REPLACE FUNCTION public.refresh_job_billing_after_work_order_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_live_job_billing_total(OLD.job_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.job_id IS DISTINCT FROM NEW.job_id THEN
    PERFORM public.refresh_live_job_billing_total(OLD.job_id);
  END IF;

  PERFORM public.refresh_live_job_billing_total(NEW.job_id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_job_billing_after_work_order_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_job_billing_after_work_order_change() FROM authenticated;
REVOKE ALL ON FUNCTION public.refresh_job_billing_after_work_order_change() FROM service_role;

DROP TRIGGER IF EXISTS refresh_job_billing_after_work_order_change_trigger
  ON public.work_orders;
CREATE TRIGGER refresh_job_billing_after_work_order_change_trigger
AFTER INSERT OR DELETE OR UPDATE OF
  job_id,
  is_active,
  painted_ceilings,
  ceiling_billing_detail_id,
  individual_ceiling_count,
  ceiling_display_label,
  has_accent_wall,
  accent_wall_billing_detail_id,
  accent_wall_count,
  accent_wall_type,
  additional_services,
  extra_charges_line_items,
  misc_additional_cost_items
ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.refresh_job_billing_after_work_order_change();

-- Approval decisions determine whether live extras enter the canonical total.
CREATE OR REPLACE FUNCTION public.refresh_job_billing_after_approval_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(NEW.approval_type, '') = 'extra_charges' THEN
    PERFORM public.refresh_live_job_billing_total(NEW.job_id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_job_billing_after_approval_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_job_billing_after_approval_change() FROM authenticated;
REVOKE ALL ON FUNCTION public.refresh_job_billing_after_approval_change() FROM service_role;

DROP TRIGGER IF EXISTS refresh_job_billing_after_approval_insert_trigger
  ON public.approval_tokens;
CREATE TRIGGER refresh_job_billing_after_approval_insert_trigger
AFTER INSERT ON public.approval_tokens
FOR EACH ROW
EXECUTE FUNCTION public.refresh_job_billing_after_approval_change();

DROP TRIGGER IF EXISTS refresh_job_billing_after_approval_update_trigger
  ON public.approval_tokens;
CREATE TRIGGER refresh_job_billing_after_approval_update_trigger
AFTER UPDATE OF decision, invalidated_at ON public.approval_tokens
FOR EACH ROW
WHEN (
  OLD.decision IS DISTINCT FROM NEW.decision
  OR OLD.invalidated_at IS DISTINCT FROM NEW.invalidated_at
)
EXECUTE FUNCTION public.refresh_job_billing_after_approval_change();

-- Phase changes affect the compatibility approval rule for older jobs without
-- a permanent approval decision. Property, unit-size, and job-category changes
-- can change the selected base billing detail.
CREATE OR REPLACE FUNCTION public.refresh_job_billing_after_job_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_phase_label text;
BEGIN
  SELECT job_phase_label
  INTO v_phase_label
  FROM public.job_phases
  WHERE id = NEW.current_phase_id;

  IF v_phase_label = 'Cancelled'
     AND NEW.active_snapshot_id IS NOT NULL
     AND (
       OLD.cancellation_trip_charge_added IS DISTINCT FROM NEW.cancellation_trip_charge_added
       OR OLD.cancellation_trip_charge_bill_amount IS DISTINCT FROM NEW.cancellation_trip_charge_bill_amount
       OR OLD.cancellation_trip_charge_sub_pay_amount IS DISTINCT FROM NEW.cancellation_trip_charge_sub_pay_amount
     ) THEN
    PERFORM public.create_or_refresh_job_snapshot(
      NEW.id,
      'Cancellation trip charge updated',
      auth.uid(),
      false
    );
    RETURN NEW;
  END IF;

  PERFORM public.refresh_live_job_billing_total(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_job_billing_after_job_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_job_billing_after_job_change() FROM authenticated;
REVOKE ALL ON FUNCTION public.refresh_job_billing_after_job_change() FROM service_role;

DROP TRIGGER IF EXISTS refresh_job_billing_after_phase_change_trigger
  ON public.jobs;
DROP TRIGGER IF EXISTS refresh_job_billing_after_job_change_trigger
  ON public.jobs;
CREATE TRIGGER refresh_job_billing_after_job_change_trigger
AFTER UPDATE OF
  current_phase_id,
  property_id,
  unit_size_id,
  job_category_id,
  cancellation_trip_charge_added,
  cancellation_trip_charge_bill_amount,
  cancellation_trip_charge_sub_pay_amount
ON public.jobs
FOR EACH ROW
WHEN (
  OLD.current_phase_id IS DISTINCT FROM NEW.current_phase_id
  OR OLD.property_id IS DISTINCT FROM NEW.property_id
  OR OLD.unit_size_id IS DISTINCT FROM NEW.unit_size_id
  OR OLD.job_category_id IS DISTINCT FROM NEW.job_category_id
  OR OLD.cancellation_trip_charge_added IS DISTINCT FROM NEW.cancellation_trip_charge_added
  OR OLD.cancellation_trip_charge_bill_amount IS DISTINCT FROM NEW.cancellation_trip_charge_bill_amount
  OR OLD.cancellation_trip_charge_sub_pay_amount IS DISTINCT FROM NEW.cancellation_trip_charge_sub_pay_amount
)
EXECUTE FUNCTION public.refresh_job_billing_after_job_change();

-- Keep only the canonical active live work order aligned with a changed extra-
-- charge billing detail. Historical/snapshot jobs and inactive work orders are
-- never rewritten.
CREATE OR REPLACE FUNCTION public.sync_live_work_orders_for_billing_detail(
  p_billing_detail_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_work_order record;
  v_updated_items jsonb;
  v_caller_id uuid := auth.uid();
  v_original_claim_sub text := current_setting('request.jwt.claim.sub', true);
BEGIN
  FOR v_work_order IN
    SELECT wo.id, wo.job_id, wo.extra_charges_line_items, j.created_by
    FROM public.work_orders AS wo
    JOIN public.jobs AS j ON j.id = wo.job_id
    WHERE wo.is_active IS TRUE
      AND COALESCE(j.historical_data_mode, 'live') = 'live'
      AND j.active_snapshot_id IS NULL
      AND jsonb_typeof(wo.extra_charges_line_items) = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(wo.extra_charges_line_items) AS item(value)
        WHERE item.value->>'detailId' = p_billing_detail_id::text
      )
    ORDER BY wo.id
  LOOP
    IF v_caller_id IS NULL AND v_work_order.created_by IS NOT NULL THEN
      PERFORM set_config(
        'request.jwt.claim.sub',
        v_work_order.created_by::text,
        true
      );
    END IF;

    SELECT jsonb_agg(
      CASE
        WHEN item.value->>'detailId' = bd.id::text THEN
          CASE
            WHEN bd.is_hourly THEN item.value
            ELSE item.value - 'billHours' - 'subPayHours'
          END
          || jsonb_build_object(
            'billRate', COALESCE(bd.bill_amount, 0),
            'subRate', COALESCE(bd.sub_pay_amount, 0),
            'isHourly', COALESCE(bd.is_hourly, false),
            'customizeHours',
              COALESCE(bd.is_hourly, false)
              AND lower(COALESCE(item.value->>'customizeHours', 'false'))
                    IN ('true', 't', '1', 'yes'),
            'calculatedBillAmount',
              round(
                COALESCE(bd.bill_amount, 0) * CASE
                  WHEN COALESCE(bd.is_hourly, false)
                    AND lower(COALESCE(item.value->>'customizeHours', 'false'))
                          IN ('true', 't', '1', 'yes')
                    AND COALESCE(item.value->>'billHours', '')
                          ~ '^[0-9]+([.][0-9]+)?$'
                  THEN (item.value->>'billHours')::numeric
                  ELSE public.billing_numeric(item.value->>'quantity')
                END,
                2
              ),
            'calculatedSubAmount',
              round(
                COALESCE(bd.sub_pay_amount, 0) * CASE
                  WHEN COALESCE(bd.is_hourly, false)
                    AND lower(COALESCE(item.value->>'customizeHours', 'false'))
                          IN ('true', 't', '1', 'yes')
                    AND COALESCE(item.value->>'subPayHours', '')
                          ~ '^[0-9]+([.][0-9]+)?$'
                  THEN (item.value->>'subPayHours')::numeric
                  ELSE public.billing_numeric(item.value->>'quantity')
                END,
                2
              )
          )
        ELSE item.value
      END
      ORDER BY item.ordinality
    )
    INTO v_updated_items
    FROM jsonb_array_elements(v_work_order.extra_charges_line_items)
      WITH ORDINALITY AS item(value, ordinality)
    CROSS JOIN public.billing_details AS bd
    WHERE bd.id = p_billing_detail_id;

    IF v_updated_items IS NOT NULL
       AND v_updated_items IS DISTINCT FROM v_work_order.extra_charges_line_items THEN
      UPDATE public.work_orders
      SET extra_charges_line_items = v_updated_items
      WHERE id = v_work_order.id
        AND is_active IS TRUE;
    END IF;
  END LOOP;

  IF v_caller_id IS NULL THEN
    PERFORM set_config(
      'request.jwt.claim.sub',
      COALESCE(v_original_claim_sub, ''),
      true
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_live_work_orders_for_billing_detail(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_live_work_orders_for_billing_detail(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.sync_live_work_orders_for_billing_detail(uuid) FROM service_role;

CREATE OR REPLACE FUNCTION public.sync_live_work_orders_after_billing_detail_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job_id uuid;
  v_property_id uuid;
  v_property_ids uuid[];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.property_id IS DISTINCT FROM NEW.property_id
       AND EXISTS (
         SELECT 1
         FROM public.work_orders AS wo
         JOIN public.jobs AS j ON j.id = wo.job_id
         WHERE wo.is_active IS TRUE
           AND COALESCE(j.historical_data_mode, 'live') = 'live'
           AND j.active_snapshot_id IS NULL
           AND j.property_id IS DISTINCT FROM NEW.property_id
           AND (
             wo.ceiling_billing_detail_id = NEW.id
             OR wo.accent_wall_billing_detail_id = NEW.id
             OR EXISTS (
               SELECT 1
               FROM jsonb_each(
                 CASE WHEN jsonb_typeof(wo.additional_services) = 'object'
                   THEN wo.additional_services ELSE '{}'::jsonb END
               ) AS svc(service_key, service_value)
               WHERE jsonb_typeof(svc.service_value) = 'object'
                 AND svc.service_value->>'billing_detail_id' = NEW.id::text
             )
             OR EXISTS (
               SELECT 1
               FROM jsonb_array_elements(
                 CASE WHEN jsonb_typeof(wo.extra_charges_line_items) = 'array'
                   THEN wo.extra_charges_line_items ELSE '[]'::jsonb END
               ) AS item(value)
               WHERE item.value->>'detailId' = NEW.id::text
             )
           )
       ) THEN
      RAISE EXCEPTION
        'Billing detail % is referenced by an active live work order and cannot move to another property',
        NEW.id;
    END IF;

    PERFORM public.sync_live_work_orders_for_billing_detail(NEW.id);
    v_property_ids := ARRAY[OLD.property_id, NEW.property_id];
  ELSIF TG_OP = 'INSERT' THEN
    v_property_ids := ARRAY[NEW.property_id];
  ELSE
    v_property_ids := ARRAY[OLD.property_id];
  END IF;

  -- A billing-detail rate may supply base billing, a ceiling, an accent wall,
  -- a dynamic service, or a standard extra. Refresh every mutable job at the
  -- affected property so no cached total depends on which representation
  -- references the changed detail.
  FOR v_property_id IN
    SELECT DISTINCT affected.property_id
    FROM unnest(v_property_ids) AS affected(property_id)
    WHERE affected.property_id IS NOT NULL
    ORDER BY affected.property_id
  LOOP
    FOR v_job_id IN
      SELECT DISTINCT j.id
      FROM public.jobs AS j
      JOIN public.work_orders AS wo
        ON wo.job_id = j.id
       AND wo.is_active IS TRUE
      WHERE j.property_id = v_property_id
        AND COALESCE(j.historical_data_mode, 'live') = 'live'
        AND j.active_snapshot_id IS NULL
      ORDER BY j.id
    LOOP
      PERFORM public.refresh_live_job_billing_total(v_job_id);
    END LOOP;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_live_work_orders_after_billing_detail_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_live_work_orders_after_billing_detail_change() FROM authenticated;
REVOKE ALL ON FUNCTION public.sync_live_work_orders_after_billing_detail_change() FROM service_role;

-- Dynamic service references live inside JSON and therefore cannot have a
-- normal foreign key. Refuse to delete a rate that an active live work order
-- still needs; otherwise the service would silently disappear from its total.
CREATE OR REPLACE FUNCTION public.prevent_referenced_live_billing_detail_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.work_orders AS wo
    JOIN public.jobs AS j ON j.id = wo.job_id
    CROSS JOIN LATERAL jsonb_each(
      CASE
        WHEN jsonb_typeof(wo.additional_services) = 'object'
          THEN wo.additional_services
        ELSE '{}'::jsonb
      END
    ) AS svc(service_key, service_value)
    WHERE wo.is_active IS TRUE
      AND COALESCE(j.historical_data_mode, 'live') = 'live'
      AND j.active_snapshot_id IS NULL
      AND jsonb_typeof(svc.service_value) = 'object'
      AND svc.service_value->>'billing_detail_id' = OLD.id::text
  ) THEN
    RAISE EXCEPTION
      'Billing detail % is referenced by an active live work order and cannot be deleted',
      OLD.id;
  END IF;

  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_referenced_live_billing_detail_delete() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_referenced_live_billing_detail_delete() FROM authenticated;
REVOKE ALL ON FUNCTION public.prevent_referenced_live_billing_detail_delete() FROM service_role;

DROP TRIGGER IF EXISTS prevent_referenced_live_billing_detail_delete_trigger
  ON public.billing_details;
CREATE TRIGGER prevent_referenced_live_billing_detail_delete_trigger
BEFORE DELETE ON public.billing_details
FOR EACH ROW
EXECUTE FUNCTION public.prevent_referenced_live_billing_detail_delete();

DROP TRIGGER IF EXISTS trigger_sync_live_work_orders_after_billing_detail_change
  ON public.billing_details;
CREATE TRIGGER trigger_sync_live_work_orders_after_billing_detail_change
AFTER UPDATE OF
  bill_amount,
  sub_pay_amount,
  is_hourly,
  property_id,
  category_id,
  unit_size_id
ON public.billing_details
FOR EACH ROW
WHEN (
  OLD.bill_amount IS DISTINCT FROM NEW.bill_amount
  OR OLD.sub_pay_amount IS DISTINCT FROM NEW.sub_pay_amount
  OR OLD.is_hourly IS DISTINCT FROM NEW.is_hourly
  OR OLD.property_id IS DISTINCT FROM NEW.property_id
  OR OLD.category_id IS DISTINCT FROM NEW.category_id
  OR OLD.unit_size_id IS DISTINCT FROM NEW.unit_size_id
)
EXECUTE FUNCTION public.sync_live_work_orders_after_billing_detail_change();

DROP TRIGGER IF EXISTS trigger_refresh_live_jobs_after_billing_detail_insert_delete
  ON public.billing_details;
CREATE TRIGGER trigger_refresh_live_jobs_after_billing_detail_insert_delete
AFTER INSERT OR DELETE
ON public.billing_details
FOR EACH ROW
EXECUTE FUNCTION public.sync_live_work_orders_after_billing_detail_change();

-- New snapshots use canonical base/extra/misc values and replace the live
-- supplemental component with frozen supplemental lines captured at freeze
-- time. Existing terminal snapshots remain immutable and are reused.
CREATE OR REPLACE FUNCTION public.create_or_refresh_job_snapshot(
  p_job_id uuid,
  p_reason text DEFAULT NULL,
  p_created_by uuid DEFAULT auth.uid(),
  p_backfilled boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_phase_label text;
  v_existing_snapshot_id uuid;
  v_existing_snapshot_phase text;
  v_existing_snapshot_bill numeric(12,2);
  v_payload jsonb;
  v_snapshot_id uuid;
  v_next_version integer;
  v_work_order_id uuid;
  v_frozen_lines jsonb := '[]'::jsonb;
  v_frozen_at timestamptz := now();
  v_totals jsonb;
  v_total_bill numeric(12,2) := 0;
  v_total_sub numeric(12,2) := 0;
  v_live_supplemental_bill numeric(12,2) := 0;
  v_live_supplemental_sub numeric(12,2) := 0;
  v_frozen_supplemental_bill numeric(12,2) := 0;
  v_frozen_supplemental_sub numeric(12,2) := 0;
  v_trip_charge_added boolean := false;
  v_trip_charge_bill numeric(12,2) := 0;
  v_trip_charge_sub numeric(12,2) := 0;
BEGIN
  SELECT
    jp.job_phase_label,
    j.active_snapshot_id,
    COALESCE(j.cancellation_trip_charge_added, false),
    COALESCE(j.cancellation_trip_charge_bill_amount, 0),
    COALESCE(j.cancellation_trip_charge_sub_pay_amount, 0)
  INTO
    v_phase_label,
    v_existing_snapshot_id,
    v_trip_charge_added,
    v_trip_charge_bill,
    v_trip_charge_sub
  FROM public.jobs AS j
  LEFT JOIN public.job_phases AS jp ON jp.id = j.current_phase_id
  WHERE j.id = p_job_id
  FOR UPDATE OF j;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job % not found', p_job_id;
  END IF;

  IF NOT public.is_terminal_job_phase(v_phase_label) THEN
    RETURN NULL;
  END IF;

  IF v_existing_snapshot_id IS NOT NULL THEN
    SELECT js.snapshot_phase_label, js.total_bill
    INTO v_existing_snapshot_phase, v_existing_snapshot_bill
    FROM public.job_snapshots AS js
    WHERE js.id = v_existing_snapshot_id
      AND js.job_id = p_job_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Active financial snapshot for job % was not found', p_job_id;
    END IF;

    IF v_existing_snapshot_phase = v_phase_label THEN
      IF v_phase_label = 'Cancelled' THEN
        UPDATE public.job_snapshots
        SET snapshot_payload = snapshot_payload || jsonb_build_object(
              'cancellation_trip_charge_added', v_trip_charge_added,
              'cancellation_trip_charge_bill_amount', v_trip_charge_bill,
              'cancellation_trip_charge_sub_pay_amount', v_trip_charge_sub
            ),
            total_bill = CASE WHEN v_trip_charge_added THEN v_trip_charge_bill ELSE 0 END,
            total_sub_pay = CASE WHEN v_trip_charge_added THEN v_trip_charge_sub ELSE 0 END,
            total_profit =
              (CASE WHEN v_trip_charge_added THEN v_trip_charge_bill ELSE 0 END)
              - (CASE WHEN v_trip_charge_added THEN v_trip_charge_sub ELSE 0 END),
            updated_at = v_frozen_at
        WHERE id = v_existing_snapshot_id
          AND (
            COALESCE(snapshot_payload->>'cancellation_trip_charge_added', 'false')
              IS DISTINCT FROM v_trip_charge_added::text
            OR public.billing_numeric(snapshot_payload->>'cancellation_trip_charge_bill_amount')
              IS DISTINCT FROM v_trip_charge_bill
            OR public.billing_numeric(snapshot_payload->>'cancellation_trip_charge_sub_pay_amount')
              IS DISTINCT FROM v_trip_charge_sub
          );

        UPDATE public.jobs
        SET total_billing_amount = CASE WHEN v_trip_charge_added THEN v_trip_charge_bill ELSE 0 END,
            historical_data_mode = 'snapshot',
            snapshot_last_phase_label = v_phase_label
        WHERE id = p_job_id;
      ELSE
        UPDATE public.jobs
        SET historical_data_mode = 'snapshot',
            snapshot_last_phase_label = v_phase_label,
            total_billing_amount = COALESCE(v_existing_snapshot_bill, total_billing_amount)
        WHERE id = p_job_id;
      END IF;

      RETURN v_existing_snapshot_id;
    END IF;

    IF public.is_terminal_job_phase(v_existing_snapshot_phase) THEN
      UPDATE public.jobs
      SET historical_data_mode = 'snapshot',
          snapshot_last_phase_label = v_phase_label,
          total_billing_amount = COALESCE(v_existing_snapshot_bill, total_billing_amount)
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

  SELECT
    COALESCE(sum(public.billing_numeric(line.value->>'amountBill')), 0),
    COALESCE(sum(public.billing_numeric(line.value->>'amountSub')), 0)
  INTO v_frozen_supplemental_bill, v_frozen_supplemental_sub
  FROM jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(v_frozen_lines) = 'array' THEN v_frozen_lines
      ELSE '[]'::jsonb
    END
  ) AS line(value);

  IF v_phase_label = 'Cancelled' THEN
    -- A cancellation has no bill or subcontractor pay unless the explicit
    -- trip-charge fields say otherwise. Never freeze the full live job amount.
    v_total_bill := CASE WHEN v_trip_charge_added THEN v_trip_charge_bill ELSE 0 END;
    v_total_sub := CASE WHEN v_trip_charge_added THEN v_trip_charge_sub ELSE 0 END;
  ELSE
    -- At this point the job is still live and has no active snapshot, so the
    -- canonical calculator returns live components without snapshot recursion.
    v_totals := public.calculate_job_billing_totals_resolved(p_job_id);

    IF v_totals#>>'{validation,standard_extra_charges}' = 'malformed'
       OR v_totals#>>'{validation,misc_additional_cost_items}' = 'malformed' THEN
      RAISE EXCEPTION
        'Cannot create financial snapshot for job % because structured billing data is malformed',
        p_job_id;
    END IF;

    v_total_bill := public.billing_numeric(v_totals->>'total_bill');
    v_total_sub := public.billing_numeric(v_totals->>'total_sub_pay');
    v_live_supplemental_bill := public.billing_numeric(v_totals->>'supplemental_bill');
    v_live_supplemental_sub := public.billing_numeric(v_totals->>'supplemental_sub_pay');
    v_total_bill := v_total_bill - v_live_supplemental_bill + v_frozen_supplemental_bill;
    v_total_sub := v_total_sub - v_live_supplemental_sub + v_frozen_supplemental_sub;

    -- Freeze a self-consistent payload even if this live row is waiting for
    -- Migration 3 mirror repair. Structured values remain authoritative.
    v_payload := jsonb_set(
      jsonb_set(
        jsonb_set(
          v_payload,
          '{repair_amount}',
          to_jsonb(public.billing_numeric(v_totals->>'misc_bill')),
          true
        ),
        '{repair_sub_pay}',
        to_jsonb(public.billing_numeric(v_totals->>'misc_sub_pay')),
        true
      ),
      '{work_order,repair_cost}',
      to_jsonb(public.billing_numeric(v_totals->>'misc_bill')),
      true
    );
  END IF;

  v_payload := jsonb_set(
    v_payload,
    '{total_billing_amount}',
    to_jsonb(round(v_total_bill, 2)),
    true
  );

  UPDATE public.job_snapshots
  SET is_current = false,
      replaced_at = v_frozen_at,
      updated_at = v_frozen_at
  WHERE job_id = p_job_id
    AND is_current IS TRUE;

  SELECT COALESCE(max(js.snapshot_version), 0) + 1
  INTO v_next_version
  FROM public.job_snapshots AS js
  WHERE js.job_id = p_job_id;

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
    round(v_total_bill, 2),
    round(v_total_sub, 2),
    round(v_total_bill - v_total_sub, 2),
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
      total_billing_amount = round(v_total_bill, 2)
  WHERE id = p_job_id;

  RETURN v_snapshot_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_or_refresh_job_snapshot(uuid, text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_or_refresh_job_snapshot(uuid, text, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_refresh_job_snapshot(uuid, text, uuid, boolean) TO service_role;

COMMENT ON FUNCTION public.create_or_refresh_job_snapshot(uuid, text, uuid, boolean) IS
  'Creates canonical terminal financial snapshots, freezes supplemental lines, preserves existing terminal snapshots across terminal phase changes, and keeps cancellation trip-charge snapshots synchronized.';

COMMIT;
