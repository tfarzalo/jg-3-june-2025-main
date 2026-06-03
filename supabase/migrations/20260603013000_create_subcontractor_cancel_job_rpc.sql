CREATE OR REPLACE FUNCTION public.cancel_assigned_job_with_trip_charge(
  p_job_id uuid,
  p_bill_amount numeric,
  p_sub_pay_amount numeric
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  SELECT id
  INTO v_cancelled_phase_id
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

  SELECT public.is_admin_or_management()
  INTO v_can_manage;

  IF v_assigned_to IS DISTINCT FROM v_user_id AND NOT COALESCE(v_can_manage, false) THEN
    RAISE EXCEPTION 'You are not allowed to cancel this job';
  END IF;

  UPDATE public.jobs
  SET
    current_phase_id = v_cancelled_phase_id,
    cancellation_trip_charge_added = true,
    cancellation_trip_charge_bill_amount = GREATEST(COALESCE(p_bill_amount, 0), 0),
    cancellation_trip_charge_sub_pay_amount = GREATEST(COALESCE(p_sub_pay_amount, 0), 0),
    updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO public.job_phase_changes (
    job_id,
    changed_by,
    from_phase_id,
    to_phase_id,
    change_reason
  )
  VALUES (
    p_job_id,
    v_user_id,
    v_current_phase_id,
    v_cancelled_phase_id,
    'Job cancelled by subcontractor; Cancellation Trip Charge added ($'
      || to_char(GREATEST(COALESCE(p_bill_amount, 0), 0), 'FM999999990.00')
      || ' bill / $'
      || to_char(GREATEST(COALESCE(p_sub_pay_amount, 0), 0), 'FM999999990.00')
      || ' sub pay)'
  );

  RETURN QUERY SELECT p_job_id, v_cancelled_phase_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_assigned_job_with_trip_charge(uuid, numeric, numeric) TO authenticated;
