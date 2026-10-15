-- Close the first-approval workflow gap for work orders that were originally
-- submitted without customer-billable extras. Adding the first charge must
-- require approval just like changing a charge from an earlier approval cycle.

CREATE OR REPLACE FUNCTION public.mark_extra_charge_approval_outdated(
  p_job_id uuid,
  p_reason text DEFAULT 'extra_charge_details_changed'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invalidated integer := 0;
  v_pending_phase_id uuid;
  v_current_phase_id uuid;
  v_current_phase_label text;
  v_historical_mode text;
  v_repair_amount numeric := 0;
  v_customer_approval_required boolean := false;
BEGIN
  SELECT
    j.current_phase_id,
    jp.job_phase_label,
    COALESCE(j.historical_data_mode, 'live'),
    COALESCE(j.repair_amount, 0)
  INTO
    v_current_phase_id,
    v_current_phase_label,
    v_historical_mode,
    v_repair_amount
  FROM public.jobs j
  LEFT JOIN public.job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = p_job_id
  FOR UPDATE OF j;

  -- Frozen/terminal history remains completely untouched until the established
  -- reopen flow returns the job to live data.
  IF v_historical_mode = 'snapshot'
     AND v_current_phase_label IN ('Completed Work Orders', 'Quality Control', 'Completed', 'Invoicing', 'Cancelled', 'Archived')
  THEN
    RETURN 0;
  END IF;

  UPDATE public.approval_tokens
  SET invalidated_at = COALESCE(invalidated_at, now()),
      invalidation_reason = COALESCE(invalidation_reason, p_reason)
  WHERE job_id = p_job_id
    AND approval_type = 'extra_charges'
    AND invalidated_at IS NULL;
  GET DIAGNOSTICS v_invalidated = ROW_COUNT;

  -- There is no token to invalidate when an office user adds the first extra
  -- charge after a work order was submitted. Inspect the current live billing
  -- data so that this first approval cycle is gated too.
  SELECT v_repair_amount > 0 OR EXISTS (
    SELECT 1
    FROM public.work_orders wo
    WHERE wo.job_id = p_job_id
      AND COALESCE(wo.is_active, true)
      AND (
        COALESCE(wo.has_extra_charges, false)
        OR jsonb_array_length(CASE
          WHEN jsonb_typeof(wo.extra_charges_line_items) = 'array'
            THEN wo.extra_charges_line_items
          ELSE '[]'::jsonb
        END) > 0
        OR jsonb_array_length(CASE
          WHEN jsonb_typeof(wo.misc_additional_cost_items) = 'array'
            THEN wo.misc_additional_cost_items
          ELSE '[]'::jsonb
        END) > 0
        OR COALESCE(wo.extra_hours, 0) <> 0
        OR COALESCE(wo.repair_cost, 0) <> 0
        OR NULLIF(btrim(wo.extra_charges_description), '') IS NOT NULL
        OR NULLIF(btrim(wo.repair_description), '') IS NOT NULL
      )
  )
  INTO v_customer_approval_required;

  -- Existing requests retain the established reapproval behavior. With no
  -- prior request, only an active pre-approval phase may be moved; terminal or
  -- later workflow phases are never reopened implicitly.
  IF v_invalidated = 0 AND NOT (
    v_customer_approval_required
    AND v_current_phase_label IN ('Job Request', 'Work Order')
  ) THEN
    RETURN 0;
  END IF;

  SELECT id INTO v_pending_phase_id
  FROM public.job_phases
  WHERE job_phase_label = 'Pending Work Order'
  LIMIT 1;

  IF v_pending_phase_id IS NULL THEN
    RAISE EXCEPTION 'Pending Work Order phase not found';
  END IF;

  IF v_current_phase_id IS DISTINCT FROM v_pending_phase_id THEN
    UPDATE public.jobs
    SET current_phase_id = v_pending_phase_id, updated_at = now()
    WHERE id = p_job_id;

    INSERT INTO public.job_phase_changes (
      job_id, from_phase_id, to_phase_id, changed_by, change_reason
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
  FROM PUBLIC, anon, authenticated;

-- Reconcile the same inconsistency for requests created before this function
-- was installed. A live, undecided, non-invalidated approval is authoritative:
-- the job must remain Pending Work Order until that request is decided.
WITH pending_phase AS (
  SELECT id
  FROM public.job_phases
  WHERE job_phase_label = 'Pending Work Order'
  LIMIT 1
), affected_jobs AS MATERIALIZED (
  SELECT DISTINCT ON (j.id)
    j.id AS job_id,
    j.created_by AS changed_by,
    j.current_phase_id AS from_phase_id,
    pending_phase.id AS to_phase_id
  FROM public.jobs j
  JOIN public.job_phases current_phase ON current_phase.id = j.current_phase_id
  JOIN public.approval_tokens token_row ON token_row.job_id = j.id
  CROSS JOIN pending_phase
  WHERE current_phase.job_phase_label = 'Work Order'
    AND COALESCE(j.historical_data_mode, 'live') = 'live'
    AND token_row.approval_type = 'extra_charges'
    AND token_row.decision IS NULL
    AND token_row.used_at IS NULL
    AND token_row.invalidated_at IS NULL
  ORDER BY j.id, token_row.created_at DESC
), logged_changes AS (
  INSERT INTO public.job_phase_changes (
    job_id, from_phase_id, to_phase_id, changed_by, changed_at, change_reason
  )
  SELECT
    job_id,
    from_phase_id,
    to_phase_id,
    changed_by,
    now(),
    'Pending extra-charge approval reconciled - job moved to Pending Work Order'
  FROM affected_jobs
  RETURNING job_id
)
UPDATE public.jobs job_row
SET current_phase_id = affected_jobs.to_phase_id,
    updated_at = now()
FROM affected_jobs
WHERE job_row.id = affected_jobs.job_id
  AND EXISTS (
    SELECT 1 FROM logged_changes WHERE logged_changes.job_id = job_row.id
  );
