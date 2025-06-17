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
  
  -- Update job status to Work Order
  UPDATE jobs
  SET status = 'Work Order',
      updated_at = NOW()
  WHERE id = v_token_data.job_id;
  
  -- Create notifications for admin and management users
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
    format('%s approved extra charges of $%.2f for Job #%s', 
           COALESCE(v_token_data.approver_name, v_token_data.approver_email),
           (v_token_data.extra_charges_data->>'total')::numeric,
           v_job_work_order_num),
    'approval',
    v_token_data.job_id,
    'job',
    false,
    NOW()
  FROM profiles p
  JOIN user_role_assignments ura ON ura.user_id = p.id
  JOIN user_roles ur ON ur.id = ura.role_id
  WHERE ur.name IN ('Admin', 'JG Management');
  
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
