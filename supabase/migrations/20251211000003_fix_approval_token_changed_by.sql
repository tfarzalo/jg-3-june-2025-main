-- Fix process_approval_token to always set changed_by (not-null)
-- Mirrors the decline path logic that uses a system user fallback

DROP FUNCTION IF EXISTS public.process_approval_token(VARCHAR);

CREATE OR REPLACE FUNCTION public.process_approval_token(
  p_token VARCHAR(255)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_data RECORD;
  v_job_work_order_num INTEGER;
  v_work_order_phase_id UUID;
  v_current_phase_id UUID;
  v_system_user_id UUID;
BEGIN
  -- Step 1: Validate token
  SELECT * INTO v_token_data
  FROM approval_tokens
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid or expired approval token'
    );
  END IF;

  -- Step 2: Get job info
  SELECT work_order_num, current_phase_id
  INTO v_job_work_order_num, v_current_phase_id
  FROM jobs
  WHERE id = v_token_data.job_id;

  -- Step 3: Mark token as used with approval decision
  UPDATE approval_tokens
  SET used_at = NOW(),
      decision = 'approved',
      decision_at = NOW()
  WHERE token = p_token;

  -- Step 4: Resolve Work Order phase ID
  SELECT id INTO v_work_order_phase_id
  FROM job_phases
  WHERE job_phase_label = 'Work Order'
  LIMIT 1;

  IF v_work_order_phase_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Work Order phase not found'
    );
  END IF;

  -- Step 5: Update job phase
  UPDATE jobs
  SET current_phase_id = v_work_order_phase_id,
      updated_at = NOW()
  WHERE id = v_token_data.job_id;

  -- Step 6: Choose a system user to satisfy NOT NULL constraint
  SELECT id INTO v_system_user_id
  FROM profiles
  WHERE role IN ('admin', 'jg_management')
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_system_user_id IS NULL THEN
    SELECT id INTO v_system_user_id
    FROM profiles
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Step 7: Create phase change record (changed_by now guaranteed)
  INSERT INTO job_phase_changes (
    job_id,
    changed_by,
    from_phase_id,
    to_phase_id,
    change_reason
  ) VALUES (
    v_token_data.job_id,
    v_system_user_id,
    v_current_phase_id,
    v_work_order_phase_id,
    format('Extra charges approved by %s', COALESCE(v_token_data.approver_name, v_token_data.approver_email))
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Approval processed successfully',
    'job_id', v_token_data.job_id,
    'work_order_num', v_job_work_order_num,
    'decision', 'approved'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', format('Database error: %s', SQLERRM)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_approval_token(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION public.process_approval_token(VARCHAR) TO authenticated;

COMMENT ON FUNCTION public.process_approval_token(VARCHAR) IS
  'Processes approval token from email link, updates job to Work Order phase, records decision, and logs phase change with a system user as changed_by.';
