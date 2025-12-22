-- =====================================================
-- APPROVAL SYSTEM COMPREHENSIVE FIX V2
-- =====================================================
-- This script includes ALL fixes identified in audit
-- Run this in Supabase SQL Editor after backing up
-- Date: June 17, 2025
-- =====================================================

-- STEP 1: Add race condition protection
-- =====================================================

-- Add index for better performance and locking
CREATE INDEX IF NOT EXISTS idx_approval_tokens_unused 
ON approval_tokens(token, used_at, expires_at) 
WHERE used_at IS NULL;

COMMENT ON INDEX idx_approval_tokens_unused IS 
'Optimizes token validation queries and helps prevent race conditions';

-- STEP 2: Create system logs table for critical errors
-- =====================================================

CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level VARCHAR(20) NOT NULL CHECK (level IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  message TEXT NOT NULL,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying recent critical errors
CREATE INDEX IF NOT EXISTS idx_system_logs_level_created 
ON system_logs(level, created_at DESC)
WHERE level IN ('ERROR', 'CRITICAL');

-- RLS for system_logs
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admins can view system logs" ON system_logs;

CREATE POLICY "Admins can view system logs"
  ON system_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
    )
  );

-- Allow system to insert logs
DROP POLICY IF EXISTS "System can insert logs" ON system_logs;

CREATE POLICY "System can insert logs"
  ON system_logs
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- STEP 3: Drop and recreate process_approval_token function
-- =====================================================

DROP FUNCTION IF EXISTS process_approval_token(VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS process_approval_token(VARCHAR(255)) CASCADE;
DROP FUNCTION IF EXISTS process_approval_token(p_token VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS process_approval_token(p_token VARCHAR(255)) CASCADE;

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
        'error', 'This approval is currently being processed. Please wait.'
      );
  END;
    
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
  
  -- Step 2: Mark token as used IMMEDIATELY (before any other operations)
  UPDATE approval_tokens
  SET used_at = NOW()
  WHERE token = p_token;
  
  -- Step 3: Get the job data with current phase
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
  
  -- Step 4: Get the Work Order phase ID
  SELECT id INTO v_work_order_phase_id
  FROM job_phases
  WHERE job_phase_label = 'Work Order'
  LIMIT 1;
  
  IF v_work_order_phase_id IS NULL THEN
    -- Log critical system configuration error
    BEGIN
      INSERT INTO system_logs (level, message, context)
      VALUES (
        'CRITICAL', 
        'Work Order phase missing from job_phases table',
        json_build_object(
          'function', 'process_approval_token',
          'token_id', v_token_data.id,
          'job_id', v_token_data.job_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- If logging fails, continue anyway
      NULL;
    END;
    
    RETURN json_build_object(
      'success', false,
      'error', 'System configuration error. Our team has been notified. Please contact support.',
      'error_code', 'MISSING_PHASE'
    );
  END IF;
  
  -- Step 5: Get or create a system user ID for approvals
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
    
    IF v_system_user_id IS NULL THEN
      -- Log warning about missing users
      BEGIN
        INSERT INTO system_logs (level, message, context)
        VALUES (
          'WARNING',
          'No users found in system for job phase change attribution',
          json_build_object(
            'function', 'process_approval_token',
            'job_id', v_token_data.job_id
          )
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;
  
  -- Step 6: Update job to Work Order phase
  UPDATE jobs
  SET 
    current_phase_id = v_work_order_phase_id,
    updated_at = NOW()
  WHERE id = v_token_data.job_id;
  
  -- Step 7: Create job phase change record (if we have a valid user)
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
      v_job_data.current_phase_id,
      v_work_order_phase_id,
      format('Extra charges approved by %s via email', 
        COALESCE(v_token_data.approver_name, v_token_data.approver_email, 'Property Manager')
      ),
      NOW()
    );
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
    -- Log unexpected errors
    BEGIN
      INSERT INTO system_logs (level, message, context)
      VALUES (
        'ERROR',
        format('Unexpected error in process_approval_token: %s', SQLERRM),
        json_build_object(
          'function', 'process_approval_token',
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
GRANT EXECUTE ON FUNCTION process_approval_token(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION process_approval_token(VARCHAR) TO authenticated;

-- Add comment
COMMENT ON FUNCTION process_approval_token(VARCHAR) IS 
'Processes approval from external email link with comprehensive error handling and race condition protection. Logs critical errors to system_logs table.';

-- STEP 4: Verify installation
-- =====================================================

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ SUCCESS: Approval system comprehensive fix v2 applied!';
  RAISE NOTICE '';
  RAISE NOTICE 'Created/Updated:';
  RAISE NOTICE '- system_logs table';
  RAISE NOTICE '- idx_approval_tokens_unused index';
  RAISE NOTICE '- idx_system_logs_level_created index';
  RAISE NOTICE '- process_approval_token() function';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test approval flow with a test token';
  RAISE NOTICE '2. Monitor system_logs table for any errors';
  RAISE NOTICE '3. Update frontend code if needed';
END $$;

-- Show summary
SELECT 
  'Tables Created/Updated' as category,
  json_build_object(
    'system_logs', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'system_logs'),
    'approval_tokens_index', EXISTS(SELECT 1 FROM pg_indexes WHERE indexname = 'idx_approval_tokens_unused')
  ) as details
UNION ALL
SELECT 
  'Function Updated' as category,
  json_build_object(
    'process_approval_token', EXISTS(
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'process_approval_token'
    )
  ) as details;

-- Query to test system_logs table
SELECT 'Test query - Recent system logs (should be empty initially):' as info;
SELECT level, message, created_at 
FROM system_logs 
WHERE level IN ('ERROR', 'CRITICAL')
ORDER BY created_at DESC 
LIMIT 10;
