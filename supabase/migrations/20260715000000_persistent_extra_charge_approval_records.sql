-- Keep approval links useful as long-term records while preserving one-time
-- approve/decline actions. These functions keep the existing action deadline
-- but record the identity typed on the public approval page.

DROP FUNCTION IF EXISTS public.process_approval_token(VARCHAR);

CREATE OR REPLACE FUNCTION public.process_approval_token(
  p_token VARCHAR(255),
  p_approver_name TEXT DEFAULT NULL,
  p_approver_email TEXT DEFAULT NULL
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
  v_effective_approver_name TEXT;
  v_effective_approver_email TEXT;
BEGIN
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

  v_effective_approver_name := COALESCE(NULLIF(trim(p_approver_name), ''), v_token_data.approver_name);
  v_effective_approver_email := COALESCE(NULLIF(trim(p_approver_email), ''), v_token_data.approver_email);

  SELECT work_order_num, current_phase_id
  INTO v_job_work_order_num, v_current_phase_id
  FROM jobs
  WHERE id = v_token_data.job_id;

  UPDATE approval_tokens
  SET used_at = NOW(),
      decision = 'approved',
      decision_at = NOW(),
      approver_name = v_effective_approver_name,
      approver_email = v_effective_approver_email
  WHERE token = p_token;

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

  UPDATE jobs
  SET current_phase_id = v_work_order_phase_id,
      updated_at = NOW()
  WHERE id = v_token_data.job_id;

  SELECT id INTO v_system_user_id
  FROM profiles
  WHERE role IN ('is_super_admin', 'admin', 'jg_management')
  ORDER BY
    CASE role
      WHEN 'is_super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'jg_management' THEN 3
      ELSE 4
    END,
    created_at ASC
  LIMIT 1;

  IF v_system_user_id IS NULL THEN
    SELECT id INTO v_system_user_id
    FROM profiles
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

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
    format('Extra charges approved by %s', COALESCE(v_effective_approver_name, v_effective_approver_email))
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

GRANT EXECUTE ON FUNCTION public.process_approval_token(VARCHAR, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.process_approval_token(VARCHAR, TEXT, TEXT) TO authenticated;

DROP FUNCTION IF EXISTS public.process_decline_token(VARCHAR, TEXT);

CREATE OR REPLACE FUNCTION public.process_decline_token(
  p_token VARCHAR(255),
  p_decline_reason TEXT DEFAULT NULL,
  p_approver_name TEXT DEFAULT NULL,
  p_approver_email TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_data RECORD;
  v_job_work_order_num INTEGER;
  v_current_phase_id UUID;
  v_current_phase_label TEXT;
  v_system_user_id UUID;
  v_effective_approver_name TEXT;
  v_effective_approver_email TEXT;
BEGIN
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

  v_effective_approver_name := COALESCE(NULLIF(trim(p_approver_name), ''), v_token_data.approver_name);
  v_effective_approver_email := COALESCE(NULLIF(trim(p_approver_email), ''), v_token_data.approver_email);

  SELECT j.work_order_num, j.current_phase_id, jp.job_phase_label
  INTO v_job_work_order_num, v_current_phase_id, v_current_phase_label
  FROM jobs j
  LEFT JOIN job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = v_token_data.job_id;

  UPDATE approval_tokens
  SET used_at = NOW(),
      decision = 'declined',
      decision_at = NOW(),
      decline_reason = p_decline_reason,
      approver_name = v_effective_approver_name,
      approver_email = v_effective_approver_email
  WHERE token = p_token;

  SELECT id INTO v_system_user_id
  FROM profiles
  WHERE role IN ('is_super_admin', 'admin', 'jg_management')
  ORDER BY
    CASE role
      WHEN 'is_super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'jg_management' THEN 3
      ELSE 4
    END,
    created_at ASC
  LIMIT 1;

  IF v_system_user_id IS NULL THEN
    SELECT id INTO v_system_user_id
    FROM profiles
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

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
    v_current_phase_id,
    format('Extra charges declined by %s%s',
           COALESCE(v_effective_approver_name, v_effective_approver_email),
           CASE WHEN p_decline_reason IS NOT NULL AND p_decline_reason != ''
                THEN format('. Reason: %s', p_decline_reason)
                ELSE ''
           END)
  );

  RETURN json_build_object(
    'success', true,
    'message', 'Extra charges declined successfully',
    'job_id', v_token_data.job_id,
    'work_order_num', v_job_work_order_num,
    'decision', 'declined'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', format('Database error: %s', SQLERRM)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.process_approval_token(VARCHAR, TEXT, TEXT) IS
  'Processes one-time extra-charge approval before the response deadline, records typed approver identity, advances job to Work Order, and leaves token data available for future read-only record views.';

COMMENT ON FUNCTION public.process_decline_token(VARCHAR, TEXT, TEXT, TEXT) IS
  'Processes one-time extra-charge decline before the response deadline, records typed approver identity, and leaves token data available for future read-only record views.';
