-- =====================================================
-- COMPLETE FIX: Extra Charges Decline Functionality
-- =====================================================
-- This single script fixes the decline functionality by:
-- 1. Adding missing columns to approval_tokens table
-- 2. Creating the process_decline_token function
-- 3. Granting proper permissions
-- =====================================================

-- =====================================================
-- PART 1: Add Missing Columns to approval_tokens Table
-- =====================================================

DO $$ 
BEGIN
  RAISE NOTICE 'Adding missing columns to approval_tokens table...';
END $$;

-- Add the decision column
ALTER TABLE approval_tokens
ADD COLUMN IF NOT EXISTS decision VARCHAR(20) CHECK (decision IN ('approved', 'declined'));

-- Add the decision_at column
ALTER TABLE approval_tokens
ADD COLUMN IF NOT EXISTS decision_at TIMESTAMPTZ;

-- Add the decline_reason column
ALTER TABLE approval_tokens
ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- Create index for decision queries
CREATE INDEX IF NOT EXISTS idx_approval_tokens_decision 
ON approval_tokens(decision) WHERE decision IS NOT NULL;

DO $$ 
BEGIN
  RAISE NOTICE '✅ Columns added successfully!';
END $$;

-- =====================================================
-- PART 2: Create process_decline_token Function
-- =====================================================

DO $$ 
BEGIN
  RAISE NOTICE 'Creating process_decline_token function...';
END $$;

-- Drop existing function if it exists (to recreate clean)
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

DO $$ 
BEGIN
  RAISE NOTICE '✅ Function created successfully!';
END $$;

-- =====================================================
-- PART 3: Grant Permissions
-- =====================================================

DO $$ 
BEGIN
  RAISE NOTICE 'Granting permissions...';
END $$;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO authenticated;

-- Add function comment
COMMENT ON FUNCTION public.process_decline_token(VARCHAR, TEXT) IS 
  'Processes decline action from approval email link. Marks Extra Charges as declined without changing job phase.';

DO $$ 
BEGIN
  RAISE NOTICE '✅ Permissions granted!';
END $$;

-- =====================================================
-- PART 4: Verification
-- =====================================================

DO $$ 
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Running verification checks...';
  RAISE NOTICE '===========================================';
END $$;

-- Check 1: Verify columns exist
SELECT 
  '1. Column Check' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_tokens' AND column_name = 'decision')
    THEN '✅ decision'
    ELSE '❌ decision MISSING'
  END as decision_col,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_tokens' AND column_name = 'decision_at')
    THEN '✅ decision_at'
    ELSE '❌ decision_at MISSING'
  END as decision_at_col,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_tokens' AND column_name = 'decline_reason')
    THEN '✅ decline_reason'
    ELSE '❌ decline_reason MISSING'
  END as decline_reason_col;

-- Check 2: Verify function exists
SELECT 
  '2. Function Check' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'process_decline_token')
    THEN '✅ process_decline_token function exists'
    ELSE '❌ process_decline_token function MISSING'
  END as function_status,
  pg_get_function_arguments(p.oid) as function_signature
FROM information_schema.routines r
LEFT JOIN pg_proc p ON p.proname = r.routine_name
WHERE routine_schema = 'public' AND routine_name = 'process_decline_token';

-- Check 3: Verify permissions
SELECT 
  '3. Permission Check' as check_name,
  has_function_privilege('anon', 'public.process_decline_token(varchar, text)', 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', 'public.process_decline_token(varchar, text)', 'EXECUTE') as authenticated_can_execute;

-- Check 4: View approval_tokens table structure
SELECT 
  '4. Table Structure' as check_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'approval_tokens'
ORDER BY ordinal_position;

DO $$ 
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE '✅ ALL CHECKS COMPLETE!';
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Next step: Test the decline link as an external user';
  RAISE NOTICE '===========================================';
END $$;

-- =====================================================
-- OPTIONAL: Manual Test
-- =====================================================
-- Uncomment to test with a real token:
/*
SELECT process_decline_token(
  'paste-your-test-token-here',
  'Testing decline functionality'
);
*/

-- =====================================================
-- SUCCESS!
-- =====================================================
-- If all checks above show ✅, the decline functionality is ready.
-- Test by clicking a decline link in an Extra Charges approval email.
-- =====================================================
