#!/bin/bash

# Fix Approval Function - Remove Notification Creation
# Run this SQL in your Supabase SQL Editor

cat << 'EOF'

-- Fix approval token processing - Remove notification creation (feature removed)
-- This version ONLY updates the job phase and marks the token as used

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
  v_job_work_order_num INTEGER;
  v_work_order_phase_id UUID;
  v_current_phase_id UUID;
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
  SELECT work_order_num, current_phase_id 
  INTO v_job_work_order_num, v_current_phase_id
  FROM jobs 
  WHERE id = v_token_data.job_id;
  
  -- Mark token as used
  UPDATE approval_tokens
  SET used_at = NOW()
  WHERE token = p_token;
  
  -- Get Work Order phase ID
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
  
  -- Update job to Work Order phase
  UPDATE jobs
  SET current_phase_id = v_work_order_phase_id,
      updated_at = NOW()
  WHERE id = v_token_data.job_id;
  
  -- Create a job phase change record for tracking
  INSERT INTO job_phase_changes (
    job_id,
    changed_by,
    from_phase_id,
    to_phase_id,
    change_reason
  ) VALUES (
    v_token_data.job_id,
    NULL,
    v_current_phase_id,
    v_work_order_phase_id,
    format('Extra charges approved by %s', COALESCE(v_token_data.approver_name, v_token_data.approver_email))
  );
  
  RETURN json_build_object(
    'success', true,
    'message', 'Approval processed successfully',
    'job_id', v_token_data.job_id,
    'work_order_num', v_job_work_order_num
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', format('Database error: %s', SQLERRM)
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_approval_token(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION process_approval_token(VARCHAR) TO authenticated;

EOF

echo ""
echo "✅ Copy the SQL above and run it in Supabase SQL Editor"
echo "📍 Dashboard: https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh/sql"
echo ""
