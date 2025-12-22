-- =====================================================
-- COMPLETE FIX: Extra Charges Decline Functionality
-- =====================================================
-- This script fixes the decline function error by:
-- 1. Adding missing columns to approval_tokens table
-- 2. Creating the process_decline_token function
-- 3. Granting proper permissions
-- 4. Verifying everything works
--
-- Run this ENTIRE file in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: Fix approval_tokens Table
-- =====================================================
\echo 'PART 1: Adding missing columns to approval_tokens table...'

-- Add missing columns
ALTER TABLE approval_tokens
ADD COLUMN IF NOT EXISTS decision VARCHAR(20) CHECK (decision IN ('approved', 'declined')),
ADD COLUMN IF NOT EXISTS decision_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_approval_tokens_decision 
ON approval_tokens(decision) 
WHERE decision IS NOT NULL;

-- Add documentation comments
COMMENT ON COLUMN approval_tokens.decision IS 'Tracks whether the token was used for approval or decline';
COMMENT ON COLUMN approval_tokens.decision_at IS 'Timestamp when the approval/decline decision was made';
COMMENT ON COLUMN approval_tokens.decline_reason IS 'Optional reason provided when declining extra charges';

\echo '✅ approval_tokens table updated'

-- =====================================================
-- PART 2: Create process_decline_token Function
-- =====================================================
\echo 'PART 2: Creating process_decline_token function...'

-- Drop any existing versions to avoid conflicts
DROP FUNCTION IF EXISTS public.process_decline_token(VARCHAR, TEXT);
DROP FUNCTION IF EXISTS public.process_decline_token(TEXT, VARCHAR);

-- Create the function
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

\echo '✅ process_decline_token function created'

-- =====================================================
-- PART 3: Grant Permissions
-- =====================================================
\echo 'PART 3: Granting permissions...'

-- Grant execute permission to anonymous users (external approval links)
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO anon;

-- Grant execute permission to authenticated users (internal use)
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO authenticated;

\echo '✅ Permissions granted'

-- =====================================================
-- PART 4: Verification
-- =====================================================
\echo 'PART 4: Verifying installation...'

-- Check columns exist
SELECT 
  '1. Checking approval_tokens columns...' as step,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'approval_tokens'
  AND column_name IN ('decision', 'decision_at', 'decline_reason')
ORDER BY column_name;

-- Check function exists
SELECT 
  '2. Checking process_decline_token function...' as step,
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'process_decline_token';

-- Check permissions
SELECT 
  '3. Checking function permissions...' as step,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'process_decline_token'
ORDER BY grantee;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
SELECT 
  '🎉 INSTALLATION COMPLETE!' as status,
  'Extra Charges decline functionality is now active' as message,
  'External users can now decline Extra Charges via email link' as functionality;

-- =====================================================
-- NEXT STEPS
-- =====================================================
SELECT 
  'NEXT STEPS:' as action,
  '1. Test by clicking a decline link in an approval email' as step_1,
  '2. Verify success message appears (not error)' as step_2,
  '3. Check job details shows "Extra Charges: Declined"' as step_3,
  '4. Confirm internal notification email is sent (if configured)' as step_4;

-- =====================================================
-- OPTIONAL: Test with a sample token
-- =====================================================
-- Uncomment to test if you have a valid unused token:
/*
SELECT process_decline_token(
  'your-test-token-here',
  'Testing decline functionality after migration'
);
*/
