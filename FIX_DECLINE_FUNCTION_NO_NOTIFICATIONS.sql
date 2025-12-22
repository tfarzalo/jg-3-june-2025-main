-- =====================================================
-- FIXED: process_decline_token - NO USER_NOTIFICATIONS
-- =====================================================
-- The approval function doesn't create user_notifications anymore
-- So decline shouldn't either - just record the decline in approval_tokens
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

  -- Step 2: Get the job data
  SELECT 
    id,
    work_order_num,
    current_phase_id,
    property_id,
    unit_number
  INTO v_job_data
  FROM jobs 
  WHERE id = v_token_data.job_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Job not found. The job may have been deleted.'
    );
  END IF;

  -- Step 3: Mark token as used with decline decision
  UPDATE approval_tokens
  SET used_at = NOW(),
      decision = 'declined',
      decision_at = NOW(),
      decline_reason = p_decline_reason
  WHERE token = p_token;

  -- Step 4: Log to system_logs if available (optional, won't fail if table doesn't exist)
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
        'decline_reason', p_decline_reason
      )
    );
  EXCEPTION 
    WHEN undefined_table THEN
      -- system_logs table doesn't exist, that's ok
      NULL;
    WHEN OTHERS THEN
      -- Any other error in logging, continue anyway
      NULL;
  END;

  -- Step 5: Return success
  -- Note: Job phase does NOT change - it stays in current phase
  RETURN json_build_object(
    'success', true,
    'message', 'Extra Charges have been declined',
    'job_id', v_token_data.job_id,
    'work_order_num', v_job_data.work_order_num,
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
      -- If logging fails, continue anyway
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
  'Processes decline action from approval email link. Records decline in approval_tokens. Job phase remains unchanged. Matches process_approval_token pattern without user_notifications.';

-- Verify
SELECT 
  'Function fixed - no user_notifications!' as status,
  routine_name,
  pg_get_function_arguments(p.oid) as arguments
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
WHERE routine_schema = 'public'
  AND routine_name = 'process_decline_token';
