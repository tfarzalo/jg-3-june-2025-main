-- Require subcontractors to record why an assigned job is being cancelled.
-- Drop the prior three-argument signature so PostgREST exposes one unambiguous RPC.
DROP FUNCTION IF EXISTS public.cancel_assigned_job_with_trip_charge(uuid, numeric, numeric);

CREATE OR REPLACE FUNCTION public.cancel_assigned_job_with_trip_charge(
  p_job_id uuid,
  p_bill_amount numeric,
  p_sub_pay_amount numeric,
  p_cancellation_reason text
)
RETURNS TABLE (
  job_id uuid,
  cancelled_phase_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_current_phase_id uuid;
  v_assigned_to uuid;
  v_cancelled_phase_id uuid;
  v_can_manage boolean;
  v_bill_amount numeric := GREATEST(COALESCE(p_bill_amount, 0), 0);
  v_sub_pay_amount numeric := GREATEST(COALESCE(p_sub_pay_amount, 0), 0);
  v_include_trip_charge boolean;
  v_cancellation_reason text := btrim(COALESCE(p_cancellation_reason, ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  IF v_cancellation_reason = '' THEN
    RAISE EXCEPTION 'Cancellation reason is required';
  END IF;

  v_include_trip_charge := v_bill_amount > 0 OR v_sub_pay_amount > 0;

  SELECT id INTO v_cancelled_phase_id
  FROM public.job_phases
  WHERE job_phase_label = 'Cancelled'
  LIMIT 1;

  IF v_cancelled_phase_id IS NULL THEN
    RAISE EXCEPTION 'Cancelled phase not found';
  END IF;

  SELECT j.current_phase_id, j.assigned_to
  INTO v_current_phase_id, v_assigned_to
  FROM public.jobs j
  WHERE j.id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  SELECT public.is_admin_or_management() INTO v_can_manage;

  IF v_assigned_to IS DISTINCT FROM v_user_id AND NOT COALESCE(v_can_manage, false) THEN
    RAISE EXCEPTION 'You are not allowed to cancel this job';
  END IF;

  UPDATE public.jobs
  SET current_phase_id = v_cancelled_phase_id,
      cancellation_trip_charge_added = v_include_trip_charge,
      cancellation_trip_charge_bill_amount = v_bill_amount,
      cancellation_trip_charge_sub_pay_amount = v_sub_pay_amount,
      updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO public.job_phase_changes (
    job_id, changed_by, from_phase_id, to_phase_id, change_reason
  ) VALUES (
    p_job_id,
    v_user_id,
    v_current_phase_id,
    v_cancelled_phase_id,
    'Job cancelled by subcontractor: ' || v_cancellation_reason ||
      CASE WHEN v_include_trip_charge THEN
        '; Cancellation Trip Charge added ($'
          || to_char(v_bill_amount, 'FM999999990.00')
          || ' bill / $'
          || to_char(v_sub_pay_amount, 'FM999999990.00')
          || ' sub pay)'
      ELSE '; no Cancellation Trip Charge added'
      END
  );

  RETURN QUERY SELECT p_job_id, v_cancelled_phase_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_assigned_job_with_trip_charge(uuid, numeric, numeric, text) TO authenticated;
