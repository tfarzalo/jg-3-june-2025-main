-- Reconcile deterministic compatibility mirrors and cached totals after the
-- canonical calculator and future-write synchronization migrations.
--
-- Scope is deliberately narrow:
--   * active work orders for live jobs without a financial snapshot;
--   * misc mirrors derived from authoritative structured misc arrays; and
--   * jobs.total_billing_amount derived from the canonical resolved calculator.
--
-- Existing snapshots, inactive work orders, structured charge arrays,
-- approval decisions, and workflow phases are never rewritten.

BEGIN;

-- Serialize this repair with another attempted copy of itself. The table locks
-- below also prevent application writes from interleaving with target capture,
-- repair, and postcondition verification.
SELECT pg_advisory_xact_lock(hashtextextended(
  '20261029020000_reconcile_live_billing_mirrors_and_totals',
  0
));

LOCK TABLE
  public.jobs,
  public.work_orders,
  public.approval_tokens,
  public.job_snapshots
IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  v_count integer;
BEGIN
  IF to_regprocedure('public.calculate_job_billing_totals_resolved(uuid)') IS NULL
     OR to_regprocedure('public.refresh_live_job_billing_total(uuid)') IS NULL
     OR to_regclass('public.work_orders_one_active_per_job_idx') IS NULL THEN
    RAISE EXCEPTION
      'Run billing migrations 20261029000000 and 20261029010000 before Migration 3';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger AS trigger_row
    WHERE trigger_row.tgrelid = 'public.work_orders'::regclass
      AND trigger_row.tgname = 'require_reapproval_after_extra_charge_change_trigger'
      AND NOT trigger_row.tgisinternal
      AND trigger_row.tgenabled = 'O'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_trigger AS trigger_row
    WHERE trigger_row.tgrelid = 'public.jobs'::regclass
      AND trigger_row.tgname = 'require_reapproval_after_job_misc_change_trigger'
      AND NOT trigger_row.tgisinternal
      AND trigger_row.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION
      'Expected approval-protection triggers are missing or disabled; reconciliation stopped';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.jobs AS j
  LEFT JOIN public.job_snapshots AS js
    ON js.id = j.active_snapshot_id
   AND js.job_id = j.id
  WHERE (
      COALESCE(j.historical_data_mode, 'live') = 'snapshot'
      AND j.active_snapshot_id IS NULL
    ) OR (
      j.active_snapshot_id IS NOT NULL
      AND COALESCE(j.historical_data_mode, 'live') <> 'snapshot'
    ) OR (
      j.active_snapshot_id IS NOT NULL
      AND js.id IS NULL
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Migration 3 stopped: % job(s) have inconsistent snapshot state',
      v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM (
    SELECT wo.job_id
    FROM public.work_orders AS wo
    WHERE wo.is_active IS TRUE
    GROUP BY wo.job_id
    HAVING count(*) > 1
  ) AS duplicate_active_work_orders;

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Migration 3 stopped: % job(s) have multiple active work orders',
      v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.jobs AS j
  LEFT JOIN public.job_phases AS jp ON jp.id = j.current_phase_id
  WHERE COALESCE(j.historical_data_mode, 'live') = 'live'
    AND j.active_snapshot_id IS NULL
    AND jp.job_phase_label IS NOT NULL
    AND jp.job_phase_label <> 'Job Request'
    AND NOT EXISTS (
      SELECT 1
      FROM public.work_orders AS wo
      WHERE wo.job_id = j.id
        AND wo.is_active IS TRUE
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Migration 3 stopped: % post-request live job(s) have no active work order',
      v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.jobs AS j
  LEFT JOIN public.job_phases AS jp ON jp.id = j.current_phase_id
  WHERE COALESCE(j.historical_data_mode, 'live') = 'live'
    AND j.active_snapshot_id IS NULL
    AND jp.id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.work_orders AS wo
      WHERE wo.job_id = j.id
        AND wo.is_active IS TRUE
    );

  IF v_count > 0 THEN
    RAISE NOTICE
      'Migration 3 will leave % legacy phase-less job(s) without work orders unchanged',
      v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM public.work_orders AS wo
  JOIN public.jobs AS j ON j.id = wo.job_id
  WHERE wo.is_active IS TRUE
    AND COALESCE(j.historical_data_mode, 'live') = 'live'
    AND j.active_snapshot_id IS NULL
    AND (
      wo.misc_additional_cost_items IS NULL
      OR jsonb_typeof(wo.misc_additional_cost_items) <> 'array'
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(wo.misc_additional_cost_items) = 'array'
              THEN wo.misc_additional_cost_items
            ELSE '[]'::jsonb
          END
        ) AS item(value)
        WHERE jsonb_typeof(item.value) <> 'object'
          OR COALESCE(item.value->>'price', item.value->>'billAmount', '')
                !~ '^[0-9]+([.][0-9]+)?$'
          OR (
            COALESCE(item.value->>'subPay', item.value->>'subPayAmount') IS NOT NULL
            AND COALESCE(
                  item.value->>'subPay',
                  item.value->>'subPayAmount',
                  ''
                ) !~ '^[0-9]+([.][0-9]+)?$'
          )
      )
    );

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Migration 3 stopped: % active live work order(s) have absent or malformed structured misc data',
      v_count;
  END IF;
END;
$$;

-- Preserve the Migration 2 resolved calculator as an internal compatibility
-- implementation. Migration 3 wraps it additively so existing total_bill and
-- component fields retain their approval-gated meaning while callers also get
-- explicit saved/current and reportable totals.
DO $$
BEGIN
  IF to_regprocedure('public.calculate_job_billing_totals_resolved_m2(uuid)') IS NULL THEN
    IF to_regprocedure('public.calculate_job_billing_totals_resolved(uuid)') IS NULL THEN
      RAISE EXCEPTION 'Migration 2 resolved billing calculator was not found';
    END IF;

    ALTER FUNCTION public.calculate_job_billing_totals_resolved(uuid)
      RENAME TO calculate_job_billing_totals_resolved_m2;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_job_billing_totals_resolved_m2(uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.calculate_job_billing_totals_resolved(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_totals jsonb;
  v_details jsonb;
  v_work_order jsonb;
  v_legacy_extra jsonb;
  v_item jsonb;
  v_phase_label text;
  v_source text;
  v_current_standard_bill numeric := 0;
  v_current_standard_sub numeric := 0;
  v_current_misc_bill numeric := 0;
  v_current_misc_sub numeric := 0;
  v_current_total_bill numeric := 0;
  v_current_total_sub numeric := 0;
  v_approved_total_bill numeric := 0;
  v_approved_total_sub numeric := 0;
  v_reportable_total_bill numeric := 0;
  v_reportable_total_sub numeric := 0;
  v_charges_approved boolean := false;
  v_phase_includes_charges boolean := false;
BEGIN
  v_totals := public.calculate_job_billing_totals_resolved_m2(p_job_id);
  v_source := COALESCE(v_totals->>'source', '');
  v_approved_total_bill := public.billing_numeric(v_totals->>'total_bill');
  v_approved_total_sub := public.billing_numeric(v_totals->>'total_sub_pay');
  v_charges_approved := COALESCE((v_totals->>'charges_approved')::boolean, false);

  -- Frozen snapshots and cancellations already represent their one applicable
  -- financial total. Do not reconstruct components from live data.
  IF v_source IN ('financial_snapshot', 'cancellation_trip_charge') THEN
    RETURN v_totals || jsonb_build_object(
      'current_standard_extra_bill', public.billing_numeric(v_totals->>'standard_extra_bill'),
      'current_standard_extra_sub_pay', public.billing_numeric(v_totals->>'standard_extra_sub_pay'),
      'current_misc_bill', public.billing_numeric(v_totals->>'misc_bill'),
      'current_misc_sub_pay', public.billing_numeric(v_totals->>'misc_sub_pay'),
      'current_total_bill', v_approved_total_bill,
      'current_total_sub_pay', v_approved_total_sub,
      'approved_total_bill', v_approved_total_bill,
      'approved_total_sub_pay', v_approved_total_sub,
      'reportable_total_bill', v_approved_total_bill,
      'reportable_total_sub_pay', v_approved_total_sub,
      'charges_included_in_report', true
    );
  END IF;

  SELECT jp.job_phase_label
  INTO v_phase_label
  FROM public.jobs AS j
  LEFT JOIN public.job_phases AS jp ON jp.id = j.current_phase_id
  WHERE j.id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job % not found', p_job_id;
  END IF;

  v_phase_includes_charges := lower(COALESCE(v_phase_label, '')) IN (
    'work order',
    'completed work orders',
    'quality control',
    'completed',
    'invoicing',
    'archived'
  );

  v_details := public.get_job_details_live(p_job_id);
  v_work_order := COALESCE(v_details->'work_order', '{}'::jsonb);
  v_legacy_extra := COALESCE(v_details->'extra_charges_details', '{}'::jsonb);

  IF v_totals#>>'{validation,standard_extra_charges}' = 'malformed'
     OR v_totals#>>'{validation,misc_additional_cost_items}' = 'malformed' THEN
    RAISE EXCEPTION
      'Cannot calculate current billing totals for job % because structured billing data is malformed',
      p_job_id;
  END IF;

  -- Preserve the established standard-extra authority rule: a nonempty array
  -- replaces the legacy aggregate; empty/missing arrays retain legacy support.
  IF jsonb_typeof(v_work_order->'extra_charges_line_items') = 'array'
     AND jsonb_array_length(v_work_order->'extra_charges_line_items') > 0 THEN
    FOR v_item IN
      SELECT value
      FROM jsonb_array_elements(v_work_order->'extra_charges_line_items')
    LOOP
      v_current_standard_bill := v_current_standard_bill + CASE
        WHEN COALESCE(v_item->>'calculatedBillAmount', '')
               ~ '^[0-9]+([.][0-9]+)?$'
          THEN public.billing_numeric(v_item->>'calculatedBillAmount')
        ELSE public.billing_numeric(v_item->>'quantity')
          * public.billing_numeric(v_item->>'billRate')
      END;
      v_current_standard_sub := v_current_standard_sub + CASE
        WHEN COALESCE(v_item->>'calculatedSubAmount', '')
               ~ '^[0-9]+([.][0-9]+)?$'
          THEN public.billing_numeric(v_item->>'calculatedSubAmount')
        ELSE public.billing_numeric(v_item->>'quantity')
          * public.billing_numeric(v_item->>'subRate')
      END;
    END LOOP;
  ELSE
    v_current_standard_bill := public.billing_numeric(v_legacy_extra->>'bill_amount');
    v_current_standard_sub := public.billing_numeric(v_legacy_extra->>'sub_pay_amount');
  END IF;

  -- Any structured misc array, including [], is authoritative.
  IF jsonb_typeof(v_work_order->'misc_additional_cost_items') = 'array' THEN
    FOR v_item IN
      SELECT value
      FROM jsonb_array_elements(v_work_order->'misc_additional_cost_items')
    LOOP
      v_current_misc_bill := v_current_misc_bill + public.billing_numeric(
        COALESCE(v_item->>'price', v_item->>'billAmount')
      );
      v_current_misc_sub := v_current_misc_sub + public.billing_numeric(
        COALESCE(v_item->>'subPay', v_item->>'subPayAmount')
      );
    END LOOP;
  ELSE
    v_current_misc_bill := public.billing_numeric(
      COALESCE(v_details->>'repair_amount', v_work_order->>'repair_cost')
    );
    v_current_misc_sub := public.billing_numeric(v_details->>'repair_sub_pay');
  END IF;

  v_current_total_bill :=
      public.billing_numeric(v_totals->>'base_bill')
    + public.billing_numeric(v_totals->>'supplemental_bill')
    + v_current_standard_bill
    + v_current_misc_bill;
  v_current_total_sub :=
      public.billing_numeric(v_totals->>'base_sub_pay')
    + public.billing_numeric(v_totals->>'supplemental_sub_pay')
    + v_current_standard_sub
    + v_current_misc_sub;

  IF v_charges_approved OR v_phase_includes_charges THEN
    v_reportable_total_bill := v_current_total_bill;
    v_reportable_total_sub := v_current_total_sub;
  ELSE
    v_reportable_total_bill := v_approved_total_bill;
    v_reportable_total_sub := v_approved_total_sub;
  END IF;

  RETURN v_totals || jsonb_build_object(
    'current_standard_extra_bill', round(v_current_standard_bill, 2),
    'current_standard_extra_sub_pay', round(v_current_standard_sub, 2),
    'current_misc_bill', round(v_current_misc_bill, 2),
    'current_misc_sub_pay', round(v_current_misc_sub, 2),
    'current_total_bill', round(v_current_total_bill, 2),
    'current_total_sub_pay', round(v_current_total_sub, 2),
    'approved_total_bill', round(v_approved_total_bill, 2),
    'approved_total_sub_pay', round(v_approved_total_sub, 2),
    'reportable_total_bill', round(v_reportable_total_bill, 2),
    'reportable_total_sub_pay', round(v_reportable_total_sub, 2),
    'charges_included_in_report', v_charges_approved OR v_phase_includes_charges
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_job_billing_totals_resolved(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_job_billing_totals_resolved(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_job_billing_totals_resolved(uuid) TO service_role;

COMMENT ON FUNCTION public.calculate_job_billing_totals_resolved(uuid) IS
  'Canonical billing contract with distinct saved/current, approval-gated, reportable, cancellation, and snapshot totals. total_bill remains approval-gated for compatibility.';

-- Until every deployed browser has the corresponding application change, an
-- older Job Details page can still attempt to write its own total. Canonicalize
-- direct live-cache writes in the database so page activity cannot reintroduce
-- stale arithmetic. Snapshot-mode updates retain their frozen value.
CREATE OR REPLACE FUNCTION public.enforce_live_job_billing_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_totals jsonb;
BEGIN
  IF COALESCE(NEW.historical_data_mode, 'live') <> 'live'
     OR NEW.active_snapshot_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_totals := public.calculate_job_billing_totals_resolved(NEW.id);
  NEW.total_billing_amount := round(
    public.billing_numeric(v_totals->>'current_total_bill'),
    2
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_live_job_billing_total()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS enforce_live_job_billing_total_trigger ON public.jobs;
CREATE TRIGGER enforce_live_job_billing_total_trigger
BEFORE UPDATE OF total_billing_amount ON public.jobs
FOR EACH ROW
WHEN (OLD.total_billing_amount IS DISTINCT FROM NEW.total_billing_amount)
EXECUTE FUNCTION public.enforce_live_job_billing_total();

-- Rebind the public Job Details RPC to the additive calculator after the
-- Migration 2 implementation was renamed above.
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

-- Live operational caches represent all currently saved charges, regardless
-- of approval state. Approval/report decisions use their separate fields.
CREATE OR REPLACE FUNCTION public.refresh_live_job_billing_total(p_job_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_totals jsonb;
  v_current_total_bill numeric;
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
  v_current_total_bill := public.billing_numeric(v_totals->>'current_total_bill');

  UPDATE public.jobs
  SET total_billing_amount = round(v_current_total_bill, 2)
  WHERE id = p_job_id
    AND total_billing_amount IS DISTINCT FROM round(v_current_total_bill, 2);

  RETURN v_totals;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_live_job_billing_total(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_live_job_billing_total(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_live_job_billing_total(uuid) TO service_role;

COMMENT ON FUNCTION public.refresh_live_job_billing_total(uuid) IS
  'Recalculates the saved/current cached customer total for a live job; snapshot-backed jobs are skipped.';

-- Approval invalidation must inspect authoritative current customer charges.
-- Stale compatibility flags/descriptions and the mere fact that a former token
-- was invalidated are not sufficient reasons to move a charge-free job into
-- Pending Work Order.
CREATE OR REPLACE FUNCTION public.mark_extra_charge_approval_outdated(
  p_job_id uuid,
  p_reason text DEFAULT 'extra_charge_details_changed'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invalidated integer := 0;
  v_pending_phase_id uuid;
  v_current_phase_id uuid;
  v_current_phase_label text;
  v_historical_mode text;
  v_customer_approval_required boolean := false;
  v_totals jsonb;
BEGIN
  SELECT
    j.current_phase_id,
    jp.job_phase_label,
    COALESCE(j.historical_data_mode, 'live')
  INTO
    v_current_phase_id,
    v_current_phase_label,
    v_historical_mode
  FROM public.jobs AS j
  LEFT JOIN public.job_phases AS jp ON jp.id = j.current_phase_id
  WHERE j.id = p_job_id
  FOR UPDATE OF j;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job % was not found', p_job_id;
  END IF;

  IF v_historical_mode = 'snapshot'
     AND public.is_terminal_job_phase(v_current_phase_label) THEN
    RETURN 0;
  END IF;

  UPDATE public.approval_tokens
  SET invalidated_at = COALESCE(invalidated_at, now()),
      invalidation_reason = COALESCE(invalidation_reason, p_reason)
  WHERE job_id = p_job_id
    AND approval_type = 'extra_charges'
    AND invalidated_at IS NULL;
  GET DIAGNOSTICS v_invalidated = ROW_COUNT;

  v_totals := public.calculate_job_billing_totals_resolved(p_job_id);
  v_customer_approval_required :=
    public.billing_numeric(v_totals->>'current_standard_extra_bill') > 0
    OR public.billing_numeric(v_totals->>'current_misc_bill') > 0;

  IF NOT v_customer_approval_required THEN
    RETURN v_invalidated;
  END IF;

  -- With no prior request, only the established pre-approval phases enter the
  -- first approval cycle. A changed existing request retains reapproval logic.
  IF v_invalidated = 0
     AND v_current_phase_label NOT IN ('Job Request', 'Work Order') THEN
    RETURN 0;
  END IF;

  SELECT id
  INTO v_pending_phase_id
  FROM public.job_phases
  WHERE job_phase_label = 'Pending Work Order'
  ORDER BY id
  LIMIT 1;

  IF v_pending_phase_id IS NULL THEN
    RAISE EXCEPTION 'Pending Work Order phase was not found';
  END IF;

  IF v_current_phase_id IS DISTINCT FROM v_pending_phase_id THEN
    UPDATE public.jobs
    SET current_phase_id = v_pending_phase_id,
        updated_at = now()
    WHERE id = p_job_id;

    INSERT INTO public.job_phase_changes (
      job_id,
      from_phase_id,
      to_phase_id,
      changed_by,
      change_reason
    ) VALUES (
      p_job_id,
      v_current_phase_id,
      v_pending_phase_id,
      auth.uid(),
      CASE
        WHEN v_invalidated > 0 THEN
          'Extra charge details were modified after an approval request - updated cumulative approval required'
        ELSE
          'Customer-billable extra charges were added - job moved to Pending Work Order for approval'
      END
    );
  END IF;

  RETURN v_invalidated;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_extra_charge_approval_outdated(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Complete miscellaneous saves as one database transaction. Existing approval
-- triggers remain authoritative for invalidation and movement into Pending
-- Work Order. When the save removes the last customer-billable standard/misc
-- charge, this RPC performs the corresponding Pending -> Work Order return and
-- history entry before returning to the browser.
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
  v_current_phase_id uuid;
  v_current_phase_label text;
  v_work_order_phase_id uuid;
  v_reverted_to_work_order boolean := false;
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

  -- Lock in the same job -> work-order order used by the surrounding billing
  -- workflows. The update below remains subject to the caller's existing RLS.
  PERFORM 1
  FROM public.jobs AS j
  WHERE j.id = p_job_id
    AND COALESCE(j.historical_data_mode, 'live') = 'live'
    AND j.active_snapshot_id IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matching live job was not found or is not editable';
  END IF;

  UPDATE public.work_orders AS wo
  SET misc_additional_cost_items = p_items
  WHERE wo.id = p_work_order_id
    AND wo.job_id = p_job_id
    AND wo.is_active IS TRUE
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

  SELECT j.current_phase_id, jp.job_phase_label
  INTO v_current_phase_id, v_current_phase_label
  FROM public.jobs AS j
  LEFT JOIN public.job_phases AS jp ON jp.id = j.current_phase_id
  WHERE j.id = p_job_id;

  IF v_current_phase_label = 'Pending Work Order'
     AND public.billing_numeric(v_totals->>'current_standard_extra_bill') = 0
     AND public.billing_numeric(v_totals->>'current_misc_bill') = 0 THEN
    SELECT id
    INTO v_work_order_phase_id
    FROM public.job_phases
    WHERE job_phase_label = 'Work Order'
    ORDER BY id
    LIMIT 1;

    IF v_work_order_phase_id IS NULL THEN
      RAISE EXCEPTION 'Work Order phase was not found';
    END IF;

    UPDATE public.jobs
    SET current_phase_id = v_work_order_phase_id
    WHERE id = p_job_id
      AND current_phase_id = v_current_phase_id;

    IF FOUND THEN
      INSERT INTO public.job_phase_changes (
        job_id,
        from_phase_id,
        to_phase_id,
        changed_by,
        change_reason
      ) VALUES (
        p_job_id,
        v_current_phase_id,
        v_work_order_phase_id,
        auth.uid(),
        'Admin cleared the last customer-billable extra charge - job returned to Work Order'
      );
      v_reverted_to_work_order := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'job_id', p_job_id,
    'work_order_id', p_work_order_id,
    'item_count', jsonb_array_length(p_items),
    'bill_total', round(v_bill, 2),
    'sub_pay_total', round(v_sub_pay, 2),
    'current_total_bill', public.billing_numeric(v_totals->>'current_total_bill'),
    'current_total_sub_pay', public.billing_numeric(v_totals->>'current_total_sub_pay'),
    'approved_total_bill', public.billing_numeric(v_totals->>'approved_total_bill'),
    'reportable_total_bill', public.billing_numeric(v_totals->>'reportable_total_bill'),
    'reverted_to_work_order', v_reverted_to_work_order
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_misc_additional_costs(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_misc_additional_costs(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_misc_additional_costs(uuid, uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.save_misc_additional_costs(uuid, uuid, jsonb) IS
  'Atomically saves structured miscellaneous costs, synchronizes compatibility mirrors/current totals, preserves approval-trigger behavior, and returns Pending Work Order to Work Order when no customer-billable standard or misc charge remains.';

-- Replace the Migration 2 snapshot writer in place so all existing callers
-- and dependencies keep the same function identity. Newly created terminal
-- snapshots freeze reportable totals; existing terminal snapshots remain
-- immutable except for the established same-phase cancellation correction.
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
    v_total_bill := CASE WHEN v_trip_charge_added THEN v_trip_charge_bill ELSE 0 END;
    v_total_sub := CASE WHEN v_trip_charge_added THEN v_trip_charge_sub ELSE 0 END;
  ELSE
    v_totals := public.calculate_job_billing_totals_resolved(p_job_id);

    IF v_totals#>>'{validation,standard_extra_charges}' = 'malformed'
       OR v_totals#>>'{validation,misc_additional_cost_items}' = 'malformed' THEN
      RAISE EXCEPTION
        'Cannot create financial snapshot for job % because structured billing data is malformed',
        p_job_id;
    END IF;

    v_total_bill := public.billing_numeric(v_totals->>'reportable_total_bill');
    v_total_sub := public.billing_numeric(v_totals->>'reportable_total_sub_pay');
    v_live_supplemental_bill := public.billing_numeric(v_totals->>'supplemental_bill');
    v_live_supplemental_sub := public.billing_numeric(v_totals->>'supplemental_sub_pay');
    v_total_bill := v_total_bill - v_live_supplemental_bill + v_frozen_supplemental_bill;
    v_total_sub := v_total_sub - v_live_supplemental_sub + v_frozen_supplemental_sub;

    v_payload := jsonb_set(
      jsonb_set(
        jsonb_set(
          v_payload,
          '{repair_amount}',
          to_jsonb(public.billing_numeric(v_totals->>'current_misc_bill')),
          true
        ),
        '{repair_sub_pay}',
        to_jsonb(public.billing_numeric(v_totals->>'current_misc_sub_pay')),
        true
      ),
      '{work_order,repair_cost}',
      to_jsonb(public.billing_numeric(v_totals->>'current_misc_bill')),
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
  'Creates reportable terminal financial snapshots, freezes supplemental lines, preserves existing terminal snapshots across terminal transitions, and keeps cancellation trip-charge snapshots synchronized.';

-- Capture every deterministic target and its expected result before changing
-- data. These transaction-local tables are also used for exact row-count and
-- postcondition checks.
CREATE TEMP TABLE migration3_work_order_targets
ON COMMIT DROP
AS
SELECT
  wo.id AS work_order_id,
  wo.job_id,
  wo.repair_cost AS before_repair_cost,
  wo.repair_description AS before_repair_description,
  round(calculated.misc_bill, 2) AS expected_repair_cost,
  COALESCE(NULLIF(calculated.misc_description, ''), '') AS expected_repair_description
FROM public.work_orders AS wo
JOIN public.jobs AS j ON j.id = wo.job_id
CROSS JOIN LATERAL (
  SELECT
    COALESCE(sum(
      public.billing_numeric(COALESCE(item.value->>'price', item.value->>'billAmount'))
    ), 0) AS misc_bill,
    COALESCE(string_agg(
      NULLIF(btrim(COALESCE(item.value->>'description', '')), ''),
      '; ' ORDER BY item.ordinality
    ), '') AS misc_description
  FROM jsonb_array_elements(wo.misc_additional_cost_items)
    WITH ORDINALITY AS item(value, ordinality)
) AS calculated
WHERE wo.is_active IS TRUE
  AND COALESCE(j.historical_data_mode, 'live') = 'live'
  AND j.active_snapshot_id IS NULL
  AND (
    wo.repair_cost IS DISTINCT FROM round(calculated.misc_bill, 2)
    OR COALESCE(wo.repair_description, '') IS DISTINCT FROM
       COALESCE(NULLIF(calculated.misc_description, ''), '')
  );

ALTER TABLE migration3_work_order_targets
  ADD PRIMARY KEY (work_order_id);

CREATE TEMP TABLE migration3_job_mirror_targets
ON COMMIT DROP
AS
SELECT
  j.id AS job_id,
  j.repair_amount AS before_repair_amount,
  j.repair_sub_pay AS before_repair_sub_pay,
  round(calculated.misc_bill, 2) AS expected_repair_amount,
  round(calculated.misc_sub_pay, 2) AS expected_repair_sub_pay
FROM public.jobs AS j
JOIN public.work_orders AS wo
  ON wo.job_id = j.id
 AND wo.is_active IS TRUE
CROSS JOIN LATERAL (
  SELECT
    COALESCE(sum(
      public.billing_numeric(COALESCE(item.value->>'price', item.value->>'billAmount'))
    ), 0) AS misc_bill,
    COALESCE(sum(
      public.billing_numeric(COALESCE(item.value->>'subPay', item.value->>'subPayAmount'))
    ), 0) AS misc_sub_pay
  FROM jsonb_array_elements(wo.misc_additional_cost_items) AS item(value)
) AS calculated
WHERE COALESCE(j.historical_data_mode, 'live') = 'live'
  AND j.active_snapshot_id IS NULL
  AND (
    j.repair_amount IS DISTINCT FROM round(calculated.misc_bill, 2)
    OR j.repair_sub_pay IS DISTINCT FROM round(calculated.misc_sub_pay, 2)
  );

ALTER TABLE migration3_job_mirror_targets
  ADD PRIMARY KEY (job_id);

-- The resolved calculator is evaluated for every live job before any repair.
-- Any unresolved or malformed billing input therefore aborts the transaction
-- before the first persistent row is changed.
CREATE TEMP TABLE migration3_job_total_targets
ON COMMIT DROP
AS
SELECT
  j.id AS job_id,
  j.total_billing_amount AS before_total_billing_amount,
  round(public.billing_numeric(totals.value->>'current_total_bill'), 2)
    AS expected_total_billing_amount
FROM public.jobs AS j
LEFT JOIN public.job_phases AS jp ON jp.id = j.current_phase_id
CROSS JOIN LATERAL (
  SELECT public.calculate_job_billing_totals_resolved(j.id) AS value
) AS totals
WHERE COALESCE(j.historical_data_mode, 'live') = 'live'
  AND j.active_snapshot_id IS NULL
  AND (
    jp.job_phase_label = 'Job Request'
    OR EXISTS (
      SELECT 1
      FROM public.work_orders AS eligible_wo
      WHERE eligible_wo.job_id = j.id
        AND eligible_wo.is_active IS TRUE
    )
  )
  AND j.total_billing_amount IS DISTINCT FROM
      round(public.billing_numeric(totals.value->>'current_total_bill'), 2);

ALTER TABLE migration3_job_total_targets
  ADD PRIMARY KEY (job_id);

-- Record workflow state for every touched job. Mirror reconciliation must not
-- invalidate an approval or move a job because no authoritative charge changed.
CREATE TEMP TABLE migration3_workflow_before
ON COMMIT DROP
AS
SELECT
  j.id AS job_id,
  j.current_phase_id,
  COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', token_row.id,
        'decision', token_row.decision,
        'invalidated_at', token_row.invalidated_at,
        'invalidation_reason', token_row.invalidation_reason,
        'used_at', token_row.used_at
      ) ORDER BY token_row.id
    ) FILTER (WHERE token_row.id IS NOT NULL),
    '[]'::jsonb
  ) AS approval_state
FROM public.jobs AS j
LEFT JOIN public.approval_tokens AS token_row
  ON token_row.job_id = j.id
 AND token_row.approval_type = 'extra_charges'
WHERE j.id IN (
  SELECT job_id FROM migration3_work_order_targets
  UNION
  SELECT job_id FROM migration3_job_mirror_targets
  UNION
  SELECT job_id FROM migration3_job_total_targets
)
GROUP BY j.id, j.current_phase_id;

ALTER TABLE migration3_workflow_before
  ADD PRIMARY KEY (job_id);

-- These two triggers intentionally interpret compatibility-mirror changes as
-- customer charge changes. Disable only those named triggers while the tables
-- are write-locked. Other triggers, including normal audit logging, remain on.
ALTER TABLE public.work_orders
  DISABLE TRIGGER require_reapproval_after_extra_charge_change_trigger;
ALTER TABLE public.jobs
  DISABLE TRIGGER require_reapproval_after_job_misc_change_trigger;

DO $$
DECLARE
  v_expected integer;
  v_updated integer;
BEGIN
  SELECT count(*) INTO v_expected FROM migration3_work_order_targets;

  UPDATE public.work_orders AS wo
  SET repair_cost = target.expected_repair_cost,
      repair_description = target.expected_repair_description
  FROM migration3_work_order_targets AS target
  WHERE wo.id = target.work_order_id
    AND wo.job_id = target.job_id
    AND wo.is_active IS TRUE
    AND wo.repair_cost IS NOT DISTINCT FROM target.before_repair_cost
    AND wo.repair_description IS NOT DISTINCT FROM target.before_repair_description;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> v_expected THEN
    RAISE EXCEPTION
      'Migration 3 work-order repair count mismatch: expected %, updated %',
      v_expected,
      v_updated;
  END IF;

  SELECT count(*) INTO v_expected FROM migration3_job_mirror_targets;

  UPDATE public.jobs AS j
  SET repair_amount = target.expected_repair_amount,
      repair_sub_pay = target.expected_repair_sub_pay
  FROM migration3_job_mirror_targets AS target
  WHERE j.id = target.job_id
    AND COALESCE(j.historical_data_mode, 'live') = 'live'
    AND j.active_snapshot_id IS NULL
    AND j.repair_amount IS NOT DISTINCT FROM target.before_repair_amount
    AND j.repair_sub_pay IS NOT DISTINCT FROM target.before_repair_sub_pay;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> v_expected THEN
    RAISE EXCEPTION
      'Migration 3 job-mirror repair count mismatch: expected %, updated %',
      v_expected,
      v_updated;
  END IF;

  SELECT count(*) INTO v_expected FROM migration3_job_total_targets;

  UPDATE public.jobs AS j
  SET total_billing_amount = target.expected_total_billing_amount
  FROM migration3_job_total_targets AS target
  WHERE j.id = target.job_id
    AND COALESCE(j.historical_data_mode, 'live') = 'live'
    AND j.active_snapshot_id IS NULL
    AND j.total_billing_amount IS NOT DISTINCT FROM
        target.before_total_billing_amount;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> v_expected THEN
    RAISE EXCEPTION
      'Migration 3 total-cache repair count mismatch: expected %, updated %',
      v_expected,
      v_updated;
  END IF;
END;
$$;

ALTER TABLE public.work_orders
  ENABLE TRIGGER require_reapproval_after_extra_charge_change_trigger;
ALTER TABLE public.jobs
  ENABLE TRIGGER require_reapproval_after_job_misc_change_trigger;

DO $$
DECLARE
  v_count integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger AS trigger_row
    WHERE trigger_row.tgrelid IN (
        'public.work_orders'::regclass,
        'public.jobs'::regclass
      )
      AND trigger_row.tgname IN (
        'require_reapproval_after_extra_charge_change_trigger',
        'require_reapproval_after_job_misc_change_trigger'
      )
      AND trigger_row.tgenabled <> 'O'
  ) THEN
    RAISE EXCEPTION 'Migration 3 stopped: an approval trigger was not re-enabled';
  END IF;

  SELECT count(*)
  INTO v_count
  FROM migration3_work_order_targets AS target
  JOIN public.work_orders AS wo ON wo.id = target.work_order_id
  WHERE wo.repair_cost IS DISTINCT FROM target.expected_repair_cost
     OR wo.repair_description IS DISTINCT FROM target.expected_repair_description;

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Migration 3 stopped: % work-order mirror repair(s) failed postcondition checks',
      v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM migration3_job_mirror_targets AS target
  JOIN public.jobs AS j ON j.id = target.job_id
  WHERE j.repair_amount IS DISTINCT FROM target.expected_repair_amount
     OR j.repair_sub_pay IS DISTINCT FROM target.expected_repair_sub_pay;

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Migration 3 stopped: % job mirror repair(s) failed postcondition checks',
      v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM migration3_job_total_targets AS target
  JOIN public.jobs AS j ON j.id = target.job_id
  WHERE j.total_billing_amount IS DISTINCT FROM
        target.expected_total_billing_amount;

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Migration 3 stopped: % cached-total repair(s) failed postcondition checks',
      v_count;
  END IF;

  SELECT count(*)
  INTO v_count
  FROM migration3_workflow_before AS before_state
  JOIN public.jobs AS j ON j.id = before_state.job_id
  LEFT JOIN LATERAL (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', token_row.id,
          'decision', token_row.decision,
          'invalidated_at', token_row.invalidated_at,
          'invalidation_reason', token_row.invalidation_reason,
          'used_at', token_row.used_at
        ) ORDER BY token_row.id
      ),
      '[]'::jsonb
    ) AS approval_state
    FROM public.approval_tokens AS token_row
    WHERE token_row.job_id = j.id
      AND token_row.approval_type = 'extra_charges'
  ) AS after_tokens ON true
  WHERE j.current_phase_id IS DISTINCT FROM before_state.current_phase_id
     OR after_tokens.approval_state IS DISTINCT FROM before_state.approval_state;

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Migration 3 stopped: % touched job(s) had workflow or approval state changed',
      v_count;
  END IF;

  -- Recalculate after repair rather than trusting the captured target alone.
  SELECT count(*)
  INTO v_count
  FROM public.jobs AS j
  LEFT JOIN public.job_phases AS jp ON jp.id = j.current_phase_id
  CROSS JOIN LATERAL (
    SELECT public.calculate_job_billing_totals_resolved(j.id) AS value
  ) AS totals
  WHERE COALESCE(j.historical_data_mode, 'live') = 'live'
    AND j.active_snapshot_id IS NULL
    AND (
      jp.job_phase_label = 'Job Request'
      OR EXISTS (
        SELECT 1
        FROM public.work_orders AS eligible_wo
        WHERE eligible_wo.job_id = j.id
          AND eligible_wo.is_active IS TRUE
      )
    )
    AND j.total_billing_amount IS DISTINCT FROM
        round(public.billing_numeric(totals.value->>'current_total_bill'), 2);

  IF v_count > 0 THEN
    RAISE EXCEPTION
      'Migration 3 stopped: % live job(s) remain inconsistent with canonical totals',
      v_count;
  END IF;
END;
$$;

COMMIT;
