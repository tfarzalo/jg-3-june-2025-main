-- Create a function to handle approval with elevated privileges
-- This function will be called from the approval page and has SECURITY DEFINER
-- which means it runs with the privileges of the function owner (bypassing RLS)

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
  
  -- Get the work order number for the job
  SELECT work_order_num INTO v_job_work_order_num
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
  
  -- Get current phase for change record
  DECLARE
    v_current_phase_id UUID;
  BEGIN
    SELECT current_phase_id INTO v_current_phase_id
    FROM jobs 
    WHERE id = v_token_data.job_id;
  
    -- Update job to Work Order phase
    UPDATE jobs
    SET current_phase_id = v_work_order_phase_id,
        updated_at = NOW()
    WHERE id = v_token_data.job_id;
    
    -- Create a job phase change record to trigger normal notifications
    INSERT INTO job_phase_changes (
      job_id,
      changed_by,
      from_phase_id,
      to_phase_id,
      change_reason
    ) VALUES (
      v_token_data.job_id,
      NULL, -- No specific user for approval actions
      v_current_phase_id,
      v_work_order_phase_id,
      format('Extra charges approved by %s', COALESCE(v_token_data.approver_name, v_token_data.approver_email))
    );
  
    -- Create specific approval notifications for admin and management users
    INSERT INTO user_notifications (
      user_id,
      title,
      message,
      type,
      reference_id,
      reference_type,
      is_read,
      created_at
    )
    SELECT 
      p.id,
      'Extra Charges Approved',
      format('Extra charges for Job #%s at %s Unit %s have been approved by %s', 
             v_job_work_order_num::text,
             COALESCE((v_token_data.extra_charges_data->'job_details'->>'property_name'), 'Unknown Property'),
             COALESCE((v_token_data.extra_charges_data->'job_details'->>'unit_number'), 'Unknown Unit'),
             COALESCE(v_token_data.approver_name, v_token_data.approver_email)),
      'approval',
      v_token_data.job_id,
      'job',
      false,
      NOW()
    FROM profiles p
    WHERE p.role IN ('admin', 'jg_management');
  END;
  
  -- Note: Activity logging removed as activity_logs table does not exist
  -- The notification above serves as an audit trail for the approval action
  
  RETURN json_build_object(
    'success', true,
    'message', 'Approval processed successfully'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', format('Database error: %s', SQLERRM)
  );
END;
$$;

-- Grant execute permission to anonymous users (for approval links)
GRANT EXECUTE ON FUNCTION process_approval_token(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION process_approval_token(VARCHAR) TO authenticated;
