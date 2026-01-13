/*
  # Assignment decision processing

  Adds a function to process assignment decision tokens:
  - Validates token (unused, not expired)
  - Ensures token subcontractor matches current job assignment
  - Updates jobs.assignment_status / assignment_decision_at / decline reasons
  - Clears assigned_to on decline to return job to pool
  - Marks token as used with decision + timestamp
  - Logs activity via log_activity
*/

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
  v_work_order_num INTEGER;
  v_scheduled_date TIMESTAMPTZ;
  v_sub_name TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_status TEXT;
  v_activity_id UUID;
BEGIN
  -- Validate decision
  IF p_decision NOT IN ('accepted', 'declined') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid decision');
  END IF;

  -- Fetch token
  SELECT * INTO v_token
  FROM assignment_tokens
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > v_now;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired token');
  END IF;

  -- Fetch job
  SELECT * INTO v_job FROM jobs WHERE id = v_token.job_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Job not found');
  END IF;

  SELECT property_name INTO v_property_name FROM properties WHERE id = v_job.property_id;
  SELECT full_name INTO v_sub_name FROM profiles WHERE id = v_token.subcontractor_id;
  v_work_order_num := v_job.work_order_num;
  v_scheduled_date := v_job.scheduled_date;

  -- Ensure the token subcontractor currently matches the job assignment
  IF v_job.assigned_to IS NULL OR v_job.assigned_to <> v_token.subcontractor_id THEN
    RETURN json_build_object('success', false, 'error', 'Assignment no longer valid for this subcontractor');
  END IF;

  -- Derive status
  v_status := CASE WHEN p_decision = 'accepted' THEN 'accepted' ELSE 'declined' END;

  -- Update job based on decision
  UPDATE jobs
  SET
    assignment_status = v_status,
    assignment_decision_at = v_now,
    declined_reason_code = CASE WHEN p_decision = 'declined' THEN p_decline_reason_code ELSE NULL END,
    declined_reason_text = CASE WHEN p_decision = 'declined' THEN p_decline_reason_text ELSE NULL END,
    assigned_to = CASE WHEN p_decision = 'declined' THEN NULL ELSE assigned_to END
  WHERE id = v_job.id;

  -- Mark token used
  UPDATE assignment_tokens
  SET
    used_at = v_now,
    decision = p_decision,
    decision_at = v_now
  WHERE id = v_token.id;

  -- Log activity
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
      'work_order_num', v_work_order_num,
      'property_name', v_property_name,
      'scheduled_date', v_scheduled_date
    ),
    v_token.subcontractor_id
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

GRANT EXECUTE ON FUNCTION public.process_assignment_token(TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.process_assignment_token(TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.process_assignment_token IS 'Processes assignment decision token and updates job assignment status/decision.';

-- Fetch token details with job/subcontractor context for public decision page
CREATE OR REPLACE FUNCTION public.get_assignment_token_details(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token assignment_tokens%ROWTYPE;
  v_job jobs%ROWTYPE;
  v_property properties%ROWTYPE;
  v_sub profiles%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_token
  FROM assignment_tokens
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;

  SELECT * INTO v_job FROM jobs WHERE id = v_token.job_id;
  SELECT * INTO v_property FROM properties WHERE id = v_job.property_id;
  SELECT * INTO v_sub FROM profiles WHERE id = v_token.subcontractor_id;

  RETURN json_build_object(
    'success', true,
    'token', jsonb_build_object(
      'expires_at', v_token.expires_at,
      'used_at', v_token.used_at,
      'decision', v_token.decision,
      'decision_at', v_token.decision_at,
      'subcontractor_id', v_token.subcontractor_id
    ),
    'job', jsonb_build_object(
      'id', v_job.id,
      'work_order_num', v_job.work_order_num,
      'scheduled_date', v_job.scheduled_date,
      'assignment_status', v_job.assignment_status
    ),
    'property', jsonb_build_object(
      'name', v_property.property_name,
      'address', v_property.address,
      'city', v_property.city,
      'state', v_property.state,
      'zip', v_property.zip
    ),
    'subcontractor', jsonb_build_object(
      'full_name', v_sub.full_name,
      'email', v_sub.email
    ),
    'is_valid', (v_token.used_at IS NULL AND v_token.expires_at > v_now)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_assignment_token_details(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_assignment_token_details(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_assignment_token_details IS 'Returns job/property/subcontractor context for an assignment token for public decision UI.';
