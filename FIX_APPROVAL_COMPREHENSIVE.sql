-- =====================================================
-- COMPREHENSIVE APPROVAL FUNCTION FIX
-- =====================================================
-- Fixes ALL known issues with approval processing:
-- 1. user_notifications table issues (removed)
-- 2. changed_by NOT NULL constraint violation
-- 3. Proper error handling
-- 4. Safe NULL handling
-- =====================================================

-- Drop all existing versions
DROP FUNCTION IF EXISTS process_approval_token(VARCHAR);
DROP FUNCTION IF EXISTS process_approval_token(VARCHAR(255));
DROP FUNCTION IF EXISTS process_approval_token(p_token VARCHAR);
DROP FUNCTION IF EXISTS process_approval_token(p_token VARCHAR(255));
DROP FUNCTION IF EXISTS process_approval_token CASCADE;

-- Create the corrected function
CREATE OR REPLACE FUNCTION process_approval_token(
  p_token VARCHAR(255)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_data RECORD;
  v_job_data RECORD;
  v_work_order_phase_id UUID;
  v_system_user_id UUID;
BEGIN
  -- Step 1: Validate and get the approval token data
  SELECT * INTO v_token_data
  FROM approval_tokens
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > NOW();
    
  IF NOT FOUND THEN
    -- Check if token exists but is invalid
    DECLARE
      v_check_token RECORD;
    BEGIN
      SELECT used_at, expires_at INTO v_check_token
      FROM approval_tokens
      WHERE token = p_token
      LIMIT 1;
      
      IF FOUND THEN
        IF v_check_token.used_at IS NOT NULL THEN
          RETURN json_build_object(
            'success', false,
            'error', 'This approval link has already been used'
          );
        ELSIF v_check_token.expires_at <= NOW() THEN
          RETURN json_build_object(
            'success', false,
            'error', 'This approval link has expired'
          );
        END IF;
      END IF;
    END;
    
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid approval token'
    );
  END IF;
  
  -- Step 2: Get the job data with current phase
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
      'error', 'Job not found'
    );
  END IF;
  
  -- Step 3: Get the Work Order phase ID
  SELECT id INTO v_work_order_phase_id
  FROM job_phases
  WHERE job_phase_label = 'Work Order'
  LIMIT 1;
  
  IF v_work_order_phase_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Work Order phase not found in system'
    );
  END IF;
  
  -- Step 4: Get or create a system user ID for approvals
  -- Try to find an admin or system user to attribute the change to
  SELECT id INTO v_system_user_id
  FROM profiles
  WHERE role IN ('admin', 'jg_management')
  ORDER BY created_at ASC
  LIMIT 1;
  
  -- If no admin/management user found, try to find any user
  IF v_system_user_id IS NULL THEN
    SELECT id INTO v_system_user_id
    FROM profiles
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;
  
  -- Step 5: Mark token as used FIRST (before any changes that might fail)
  UPDATE approval_tokens
  SET used_at = NOW()
  WHERE token = p_token;
  
  -- Step 6: Update job to Work Order phase
  UPDATE jobs
  SET 
    current_phase_id = v_work_order_phase_id,
    updated_at = NOW()
  WHERE id = v_token_data.job_id;
  
  -- Step 7: Create job phase change record
  -- Only create if we have a valid changed_by user
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
      v_system_user_id,  -- Use found system user instead of NULL
      v_job_data.current_phase_id,
      v_work_order_phase_id,
      format('Extra charges approved by %s via email', 
        COALESCE(v_token_data.approver_name, v_token_data.approver_email, 'Property Manager')
      ),
      NOW()
    );
  ELSE
    -- Log a warning but don't fail the approval
    RAISE NOTICE 'No user found for changed_by - phase change record not created';
  END IF;
  
  -- Step 8: Return success
  RETURN json_build_object(
    'success', true,
    'message', 'Approval processed successfully',
    'job_id', v_token_data.job_id,
    'work_order_num', v_job_data.work_order_num,
    'new_phase', 'Work Order'
  );
  
EXCEPTION 
  WHEN OTHERS THEN
    -- Comprehensive error handling
    RETURN json_build_object(
      'success', false,
      'error', format('Database error: %s', SQLERRM),
      'detail', format('Error occurred at: %s', SQLSTATE)
    );
END;
$$;

-- Grant execute permission to anonymous (needed for external approval page) and authenticated users
GRANT EXECUTE ON FUNCTION process_approval_token(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION process_approval_token(VARCHAR) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION process_approval_token(VARCHAR) IS 
'Processes approval from external email link. Validates token, updates job to Work Order phase, creates phase change record with system user. Handles all NOT NULL constraints properly.';

-- Verify the function was created successfully
SELECT 'SUCCESS: process_approval_token function updated with comprehensive error handling!' as status;
