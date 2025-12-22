-- =====================================================
-- VERIFY AND FIX: process_decline_token Function
-- =====================================================
-- This checks if the function exists and recreates it if needed
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Step 1: Check if the function exists
SELECT 
  routine_name,
  routine_type,
  data_type as return_type,
  pg_get_function_arguments(p.oid) as arguments
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
WHERE routine_schema = 'public'
  AND routine_name = 'process_decline_token';

-- If the above returns no rows, the function doesn't exist and needs to be created

-- Step 2: Drop existing function if it exists (to recreate clean)
DROP FUNCTION IF EXISTS public.process_decline_token(VARCHAR, TEXT);
DROP FUNCTION IF EXISTS public.process_decline_token(TEXT, VARCHAR);

-- Step 3: Create the function with correct signature
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

  -- Create a job phase change record to log the decline
  -- This does NOT change the phase - it stays at current phase
  INSERT INTO job_phase_changes (
    job_id,
    changed_by,
    from_phase_id,
    to_phase_id,
    change_reason
  ) VALUES (
    v_token_data.job_id,
    NULL, -- External decline, no user ID
    v_current_phase_id,
    v_current_phase_id, -- Stay at same phase
    COALESCE(
      'Extra Charges declined by property representative' || 
      CASE 
        WHEN p_decline_reason IS NOT NULL AND p_decline_reason != '' 
        THEN ': ' || p_decline_reason 
        ELSE '' 
      END,
      'Extra Charges declined'
    )
  );

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
      'error', 'An error occurred while processing the decline: ' || SQLERRM
    );
END;
$$;

-- Step 4: Grant permissions
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO authenticated;

-- Step 5: Add comment
COMMENT ON FUNCTION public.process_decline_token(VARCHAR, TEXT) IS 
  'Processes decline action from approval email link. Marks Extra Charges as declined without changing job phase.';

-- Step 6: Verify the function was created
SELECT 
  'Function created successfully!' as status,
  routine_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
WHERE routine_schema = 'public'
  AND routine_name = 'process_decline_token';

-- Step 7: Test the function (optional - use a test token)
-- Uncomment to test with a real token:
/*
SELECT process_decline_token(
  'test-token-here',
  'Testing decline functionality'
);
*/

-- =====================================================
-- TROUBLESHOOTING
-- =====================================================
-- If you still get the error after running this:
-- 1. Make sure you're connected to the correct database
-- 2. Clear Supabase schema cache by restarting the project (Settings → General → Restart project)
-- 3. Check that approval_tokens table exists with the new columns
-- =====================================================
