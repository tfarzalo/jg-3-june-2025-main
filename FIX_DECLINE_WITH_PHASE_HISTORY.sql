-- =====================================================
-- COMPLETE FIX: process_decline_token with Phase History
-- =====================================================
-- This version creates a phase change record (same phase to same phase)
-- so the decline appears in phase history and activity log
-- =====================================================

DROP FUNCTION IF EXISTS public.process_decline_token(VARCHAR, TEXT);

CREATE OR REPLACE FUNCTION public.process_decline_token(
  p_token VARCHAR(255),
  p_decline_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_data RECORD;
  v_job_data RECORD;
  v_system_user_id UUID;
  v_current_phase_label TEXT;
BEGIN
  -- Step 1: Validate and lock the approval token (prevents race conditions)
  BEGIN
    SELECT * INTO v_token_data
    FROM approval_tokens
    WHERE token = p_token
      AND used_at IS NULL
      AND expires_at > NOW()
    FOR UPDATE NOWAIT;  -- Fail immediately if already being processed
  EXCEPTION
    WHEN lock_not_available THEN
      RETURN json_build_object(
        'success', false,
        'error', 'This decline is currently being processed. Please wait.'
      );
  END;

  IF NOT FOUND THEN
    -- Check if token exists but is invalid
    DECLARE
      v_check_token RECORD;
    BEGIN
      SELECT used_at, expires_at, decision INTO v_check_token
      FROM approval_tokens
      WHERE token = p_token
      LIMIT 1;
      
      IF FOUND THEN
        IF v_check_token.used_at IS NOT NULL THEN
          IF v_check_token.decision = 'declined' THEN
            RETURN json_build_object(
              'success', false,
              'error', 'This decline link has already been used'
            );
          ELSE
            RETURN json_build_object(
              'success', false,
              'error', 'This approval link has already been used'
            );
          END IF;
        ELSIF v_check_token.expires_at <= NOW() THEN
          RETURN json_build_object(
            'success', false,
            'error', 'This decline link has expired'
          );
        END IF;
      END IF;
    END;
    
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid decline token'
    );
  END IF;

  -- Step 2: Get the job data with current phase
  SELECT 
    j.id,
    j.work_order_num,
    j.current_phase_id,
    j.property_id,
    j.unit_number,
    jp.job_phase_label
  INTO v_job_data
  FROM jobs j
  LEFT JOIN job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = v_token_data.job_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Job not found. The job may have been deleted.'
    );
  END IF;

  -- Step 3: Get or create a system user ID for the phase change record
  SELECT id INTO v_system_user_id
  FROM profiles
  WHERE role IN ('admin', 'jg_management')
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- Fallback to any user if no admin exists
  IF v_system_user_id IS NULL THEN
    SELECT id INTO v_system_user_id
    FROM profiles
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Step 4: Mark token as used with decline decision
  UPDATE approval_tokens
  SET used_at = NOW(),
      decision = 'declined',
      decision_at = NOW(),
      decline_reason = p_decline_reason
  WHERE token = p_token;

  -- Step 5: Create job phase change record (SAME phase to SAME phase)
  -- This makes the decline appear in phase history and activity log
  IF v_system_user_id IS NOT NULL THEN
    INSERT INTO job_phase_changes (
      job_id,
      changed_by,
      from_phase_id,
      to_phase_id,
      change_reason,
      changed_at
    ) VALUES (
      v_token_data.job_id,
      v_system_user_id,
      v_job_data.current_phase_id,  -- FROM same phase
      v_job_data.current_phase_id,  -- TO same phase
      format('Extra charges declined by %s via email%s', 
        COALESCE(v_token_data.approver_name, v_token_data.approver_email, 'Property Representative'),
        CASE 
          WHEN p_decline_reason IS NOT NULL AND p_decline_reason != '' 
          THEN '. Reason: ' || p_decline_reason
          ELSE ''
        END
      ),
      NOW()
    );
  END IF;

  -- Step 6: Log to system_logs if available (optional)
  BEGIN
    INSERT INTO system_logs (level, message, context)
    VALUES (
      'INFO',
      'Extra charges declined via email',
      json_build_object(
        'function', 'process_decline_token',
        'job_id', v_token_data.job_id,
        'work_order_num', v_job_data.work_order_num,
        'declined_by', COALESCE(v_token_data.approver_name, v_token_data.approver_email),
        'decline_reason', p_decline_reason,
        'current_phase', v_job_data.job_phase_label
      )
    );
  EXCEPTION 
    WHEN undefined_table THEN
      NULL;
    WHEN OTHERS THEN
      NULL;
  END;

  -- Step 7: Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Extra Charges have been declined',
    'job_id', v_token_data.job_id,
    'work_order_num', v_job_data.work_order_num,
    'current_phase', v_job_data.job_phase_label,
    'decision', 'declined',
    'decline_reason', p_decline_reason,
    'declined_by', COALESCE(v_token_data.approver_name, v_token_data.approver_email)
  );

EXCEPTION 
  WHEN OTHERS THEN
    -- Log unexpected errors
    BEGIN
      INSERT INTO system_logs (level, message, context)
      VALUES (
        'ERROR',
        format('Unexpected error in process_decline_token: %s', SQLERRM),
        json_build_object(
          'function', 'process_decline_token',
          'error_state', SQLSTATE,
          'token', p_token
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    RETURN json_build_object(
      'success', false,
      'error', 'An unexpected error occurred. Our team has been notified. Please contact support.',
      'error_code', 'INTERNAL_ERROR'
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.process_decline_token(VARCHAR, TEXT) IS 
  'Processes decline action from approval email link. Records decline in approval_tokens and creates phase change record (same phase to same phase) for activity log visibility.';

-- Verify
SELECT 
  'Function updated with phase history!' as status,
  routine_name,
  pg_get_function_arguments(p.oid) as arguments
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
WHERE routine_schema = 'public'
  AND routine_name = 'process_decline_token';
