-- Add approval/decline tracking for Extra Charges
-- This migration extends the approval_tokens table to support decline actions
-- and adds tracking fields for decision outcomes

-- Add decision status and metadata to approval_tokens
ALTER TABLE approval_tokens
  ADD COLUMN IF NOT EXISTS decision VARCHAR(20) CHECK (decision IN ('approved', 'declined')),
  ADD COLUMN IF NOT EXISTS decision_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS decline_reason TEXT;

-- Create index for querying by decision
CREATE INDEX IF NOT EXISTS idx_approval_tokens_decision ON approval_tokens(decision);

-- Add comment explaining the new fields
COMMENT ON COLUMN approval_tokens.decision IS 'The decision made on this approval request: approved or declined';
COMMENT ON COLUMN approval_tokens.decision_at IS 'Timestamp when the approval/decline decision was made';
COMMENT ON COLUMN approval_tokens.decline_reason IS 'Optional reason provided when Extra Charges are declined';

-- Update the RLS policy to allow anyone to update tokens when making a decision
DROP POLICY IF EXISTS "Anyone can update approval tokens to mark as used" ON approval_tokens;

CREATE POLICY "Anyone can update approval tokens to mark decision"
  ON approval_tokens
  FOR UPDATE
  USING (
    used_at IS NULL
    AND expires_at > NOW()
  )
  WITH CHECK (
    -- Can mark as used with a decision
    used_at IS NOT NULL
    AND decision IN ('approved', 'declined')
    AND decision_at IS NOT NULL
  );

-- Function to process decline action (parallel to approval)
CREATE OR REPLACE FUNCTION process_decline_token(
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
  -- This does NOT change the phase - it stays at current phase (e.g., "Pending Work Order")
  INSERT INTO job_phase_changes (
    job_id,
    changed_by,
    from_phase_id,
    to_phase_id,
    change_reason
  ) VALUES (
    v_token_data.job_id,
    NULL, -- No specific user for external decline actions
    v_current_phase_id,
    v_current_phase_id, -- Same phase - no transition
    format('Extra charges declined by %s%s',
           COALESCE(v_token_data.approver_name, v_token_data.approver_email),
           CASE WHEN p_decline_reason IS NOT NULL AND p_decline_reason != ''
                THEN format('. Reason: %s', p_decline_reason)
                ELSE ''
           END)
  );

  -- NOTE: We do NOT update the job phase - it stays in "Pending Work Order"
  -- This is the key difference from approval

  RETURN json_build_object(
    'success', true,
    'message', 'Extra charges declined successfully',
    'job_id', v_token_data.job_id,
    'work_order_num', v_job_work_order_num,
    'decision', 'declined'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', format('Database error: %s', SQLERRM)
  );
END;
$$;

-- Grant execute permission to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION process_decline_token(VARCHAR, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION process_decline_token(VARCHAR, TEXT) TO authenticated;

-- Add a comment explaining the function
COMMENT ON FUNCTION process_decline_token(VARCHAR, TEXT) IS 'Processes decline action from approval email link, marks Extra Charges as declined without changing job phase';

-- Update the approval function to record the approval decision
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

  -- Mark token as used with approval decision
  UPDATE approval_tokens
  SET used_at = NOW(),
      decision = 'approved',
      decision_at = NOW()
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

  -- Create a job phase change record to trigger normal phase change notifications
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

  RETURN json_build_object(
    'success', true,
    'message', 'Approval processed successfully',
    'job_id', v_token_data.job_id,
    'work_order_num', v_job_work_order_num,
    'decision', 'approved'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'error', format('Database error: %s', SQLERRM)
  );
END;
$$;

-- Update grants for the updated approval function
GRANT EXECUTE ON FUNCTION process_approval_token(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION process_approval_token(VARCHAR) TO authenticated;

-- Update comment
COMMENT ON FUNCTION process_approval_token(VARCHAR) IS 'Processes approval token from email link, updates job to Work Order phase and records approval decision';
