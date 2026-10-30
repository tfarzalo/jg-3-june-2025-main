/*
  Make subcontractor assignment decisions atomic and idempotent.

  - A pending assignment can be decided only once, including concurrent requests.
  - Dashboard decisions consume every outstanding email token for that assignment.
  - Token decisions consume sibling tokens so a second email link cannot decide again.
  - Existing job, token, and activity history is preserved.
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
  v_sub_name TEXT;
BEGIN
  IF p_decision NOT IN ('accepted', 'declined') THEN
    RETURN json_build_object('success', false, 'state_changed', false, 'error', 'Invalid decision');
  END IF;

  SELECT * INTO v_job
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'state_changed', false, 'error', 'Job not found');
  END IF;

  IF v_job.assigned_to IS NULL OR v_job.assigned_to <> auth.uid() THEN
    RETURN json_build_object('success', false, 'state_changed', false, 'error', 'Not authorized for this assignment');
  END IF;

  IF COALESCE(v_job.assignment_status, 'pending') <> 'pending' THEN
    RETURN json_build_object(
      'success', false,
      'state_changed', false,
      'code', 'already_decided',
      'error', format('Assignment already %s', v_job.assignment_status),
      'decision', v_job.assignment_status
    );
  END IF;

  SELECT property_name INTO v_property_name FROM properties WHERE id = v_job.property_id;
  SELECT full_name INTO v_sub_name FROM profiles WHERE id = auth.uid();

  UPDATE jobs
  SET
    assignment_status = p_decision,
    assignment_decision_at = v_now,
    declined_reason_code = CASE WHEN p_decision = 'declined' THEN p_decline_reason_code ELSE NULL END,
    declined_reason_text = CASE WHEN p_decision = 'declined' THEN p_decline_reason_text ELSE NULL END,
    assigned_to = CASE WHEN p_decision = 'declined' THEN NULL ELSE assigned_to END
  WHERE id = v_job.id;

  UPDATE assignment_tokens
  SET
    used_at = v_now,
    decision = p_decision,
    decision_at = v_now
  WHERE job_id = v_job.id
    AND subcontractor_id = v_job.assigned_to
    AND used_at IS NULL;

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
      'work_order_num', v_job.work_order_num,
      'property_name', v_property_name,
      'scheduled_date', v_job.scheduled_date
    ),
    auth.uid()
  );

  RETURN json_build_object(
    'success', true,
    'state_changed', true,
    'job_id', v_job.id,
    'decision', p_decision,
    'work_order_num', v_job.work_order_num,
    'property_name', v_property_name,
    'scheduled_date', v_job.scheduled_date
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'state_changed', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_assignment_decision_authenticated(UUID, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.process_assignment_decision_authenticated IS
  'Atomically records one authenticated subcontractor decision and consumes outstanding assignment email tokens.';

CREATE OR REPLACE FUNCTION public.process_assignment_token(
  p_token TEXT,
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
  v_token assignment_tokens%ROWTYPE;
  v_job jobs%ROWTYPE;
  v_property_name TEXT;
  v_sub_name TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_decision NOT IN ('accepted', 'declined') THEN
    RETURN json_build_object('success', false, 'state_changed', false, 'error', 'Invalid decision');
  END IF;

  SELECT * INTO v_token
  FROM assignment_tokens
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > v_now;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'state_changed', false, 'error', 'Invalid or expired token');
  END IF;

  -- The job row is the serialization lock shared by dashboard and email-token
  -- decisions. Do not lock an individual token first; sibling-token requests
  -- could otherwise acquire locks in opposite order.
  SELECT * INTO v_job
  FROM jobs
  WHERE id = v_token.job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'state_changed', false, 'error', 'Job not found');
  END IF;

  IF v_job.assigned_to IS NULL OR v_job.assigned_to <> v_token.subcontractor_id THEN
    RETURN json_build_object('success', false, 'state_changed', false, 'error', 'Assignment no longer valid for this subcontractor');
  END IF;

  IF COALESCE(v_job.assignment_status, 'pending') <> 'pending' THEN
    UPDATE assignment_tokens
    SET
      used_at = COALESCE(used_at, v_now),
      decision = CASE
        WHEN v_job.assignment_status IN ('accepted', 'declined') THEN v_job.assignment_status
        ELSE decision
      END,
      decision_at = CASE
        WHEN v_job.assignment_status IN ('accepted', 'declined') THEN COALESCE(decision_at, v_now)
        ELSE decision_at
      END
    WHERE job_id = v_job.id
      AND subcontractor_id = v_token.subcontractor_id
      AND used_at IS NULL;

    RETURN json_build_object(
      'success', false,
      'state_changed', false,
      'code', 'already_decided',
      'error', format('Assignment already %s', v_job.assignment_status),
      'decision', v_job.assignment_status
    );
  END IF;

  SELECT property_name INTO v_property_name FROM properties WHERE id = v_job.property_id;
  SELECT full_name INTO v_sub_name FROM profiles WHERE id = v_token.subcontractor_id;

  UPDATE jobs
  SET
    assignment_status = p_decision,
    assignment_decision_at = v_now,
    declined_reason_code = CASE WHEN p_decision = 'declined' THEN p_decline_reason_code ELSE NULL END,
    declined_reason_text = CASE WHEN p_decision = 'declined' THEN p_decline_reason_text ELSE NULL END,
    assigned_to = CASE WHEN p_decision = 'declined' THEN NULL ELSE assigned_to END
  WHERE id = v_job.id;

  UPDATE assignment_tokens
  SET
    used_at = v_now,
    decision = p_decision,
    decision_at = v_now
  WHERE job_id = v_job.id
    AND subcontractor_id = v_token.subcontractor_id
    AND used_at IS NULL;

  PERFORM log_activity(
    'job',
    v_job.id,
    CASE WHEN p_decision = 'accepted' THEN 'approved' ELSE 'rejected' END,
    format(
      'Subcontractor %s assignment %s',
      COALESCE(v_sub_name, v_token.subcontractor_id::text),
      p_decision
    ),
    jsonb_build_object(
      'job_id', v_job.id,
      'subcontractor_id', v_token.subcontractor_id,
      'subcontractor_name', v_sub_name,
      'decision', p_decision,
      'decline_reason_code', p_decline_reason_code,
      'decline_reason_text', p_decline_reason_text,
      'token_id', v_token.id,
      'work_order_num', v_job.work_order_num,
      'property_name', v_property_name,
      'scheduled_date', v_job.scheduled_date
    ),
    v_token.subcontractor_id
  );

  RETURN json_build_object(
    'success', true,
    'state_changed', true,
    'job_id', v_job.id,
    'decision', p_decision,
    'work_order_num', v_job.work_order_num,
    'property_name', v_property_name,
    'scheduled_date', v_job.scheduled_date
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'state_changed', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_assignment_token(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.process_assignment_token(TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.process_assignment_token IS
  'Atomically records one email-token assignment decision and consumes sibling assignment tokens.';
