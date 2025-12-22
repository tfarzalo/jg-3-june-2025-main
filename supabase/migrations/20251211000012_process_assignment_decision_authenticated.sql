/*
  # Authenticated assignment decision

  Allows the currently authenticated subcontractor (assigned_to) to accept or decline
  an assignment without a token. Mirrors token-based processing but uses auth.uid().
*/

CREATE OR REPLACE FUNCTION public.process_assignment_decision_authenticated(
  p_job_id UUID,
  p_decision TEXT,
  p_decline_reason_code TEXT DEFAULT NULL,
  p_decline_reason_text TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job jobs%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_property_name TEXT;
  v_work_order_num INTEGER;
  v_scheduled_date TIMESTAMPTZ;
  v_sub_name TEXT;
BEGIN
  IF p_decision NOT IN ('accepted', 'declined') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid decision');
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = p_job_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Job not found');
  END IF;

  -- Must be the assigned subcontractor
  IF v_job.assigned_to IS NULL OR v_job.assigned_to <> auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Not authorized for this assignment');
  END IF;

  SELECT property_name INTO v_property_name FROM properties WHERE id = v_job.property_id;
  SELECT full_name INTO v_sub_name FROM profiles WHERE id = auth.uid();
  v_work_order_num := v_job.work_order_num;
  v_scheduled_date := v_job.scheduled_date;

  UPDATE jobs
  SET
    assignment_status = p_decision,
    assignment_decision_at = v_now,
    declined_reason_code = CASE WHEN p_decision = 'declined' THEN p_decline_reason_code ELSE NULL END,
    declined_reason_text = CASE WHEN p_decision = 'declined' THEN p_decline_reason_text ELSE NULL END,
    assigned_to = CASE WHEN p_decision = 'declined' THEN NULL ELSE assigned_to END
  WHERE id = v_job.id;

  PERFORM log_activity(
    'job',
    v_job.id,
    CASE WHEN p_decision = 'accepted' THEN 'approved' ELSE 'rejected' END,
    format(
      'Subcontractor %s assignment %s',
      COALESCE(v_sub_name, auth.uid()::text),
      p_decision
    ),
    jsonb_build_object(
      'job_id', v_job.id,
      'subcontractor_id', auth.uid(),
      'subcontractor_name', v_sub_name,
      'decision', p_decision,
      'decline_reason_code', p_decline_reason_code,
      'decline_reason_text', p_decline_reason_text,
      'work_order_num', v_work_order_num,
      'property_name', v_property_name,
      'scheduled_date', v_scheduled_date
    ),
    auth.uid()
  );

  RETURN json_build_object(
    'success', true,
    'job_id', v_job.id,
    'decision', p_decision,
    'work_order_num', v_work_order_num,
    'property_name', v_property_name,
    'scheduled_date', v_scheduled_date
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_assignment_decision_authenticated(UUID, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.process_assignment_decision_authenticated IS 'Authenticated subcontractor accept/decline for their own assignment.';
