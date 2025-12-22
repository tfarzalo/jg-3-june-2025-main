-- =====================================================
-- FIX: process_decline_token - Handle NULL changed_by
-- =====================================================
-- The job_phase_changes table has a NOT NULL constraint on changed_by
-- but external declines don't have a user_id. We need to either:
-- 1. Make changed_by nullable, OR
-- 2. Skip inserting into job_phase_changes for declines
-- =====================================================

-- SOLUTION: Remove the job_phase_changes insert for declines
-- Declines don't change the phase anyway, so we don't need to log them there

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
  v_job_work_order_num INTEGER;
  v_current_phase_id UUID;
  v_current_phase_label TEXT;
  v_result JSON;
BEGIN
  -- Get the approval token data
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

  -- Get the work order number and current phase for the job
  SELECT j.work_order_num, j.current_phase_id, jp.job_phase_label
  INTO v_job_work_order_num, v_current_phase_id, v_current_phase_label
  FROM jobs j
  LEFT JOIN job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = v_token_data.job_id;

  -- Mark token as used with decline decision
  UPDATE approval_tokens
  SET used_at = NOW(),
      decision = 'declined',
      decision_at = NOW(),
      decline_reason = p_decline_reason
  WHERE token = p_token;

  -- NOTE: We do NOT insert into job_phase_changes because:
  -- 1. changed_by is NOT NULL but we don't have a user_id for external declines
  -- 2. The phase doesn't actually change (stays at current phase)
  -- 3. The decline is already recorded in approval_tokens with full details
  
  -- Build success response
  v_result := json_build_object(
    'success', true,
    'message', 'Extra Charges have been declined',
    'job_id', v_token_data.job_id,
    'work_order_num', v_job_work_order_num,
    'current_phase', v_current_phase_label,
    'decision', 'declined',
    'decline_reason', p_decline_reason
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', 'An error occurred: ' || SQLERRM
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.process_decline_token(VARCHAR, TEXT) IS 
  'Processes decline action from approval email link. Marks Extra Charges as declined in approval_tokens table. Does not create job_phase_changes entry since phase does not change and external user has no user_id.';

-- Verify
SELECT 
  'Function updated successfully!' as status,
  routine_name,
  pg_get_function_arguments(p.oid) as arguments
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
WHERE routine_schema = 'public'
  AND routine_name = 'process_decline_token';
