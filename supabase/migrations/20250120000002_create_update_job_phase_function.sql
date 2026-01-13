-- Create function to update job phase with RLS bypass for subcontractors
CREATE OR REPLACE FUNCTION update_job_phase(
  p_job_id UUID,
  p_new_phase_id UUID,
  p_change_reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_phase_id UUID;
  v_result JSON;
BEGIN
  -- Get current phase ID
  SELECT current_phase_id INTO v_current_phase_id
  FROM jobs
  WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Job not found'
    );
  END IF;
  
  -- Update job phase
  UPDATE jobs
  SET 
    current_phase_id = p_new_phase_id,
    updated_at = NOW()
  WHERE id = p_job_id;
  
  -- Create job phase change record
  INSERT INTO job_phase_changes (
    job_id,
    changed_by,
    from_phase_id,
    to_phase_id,
    change_reason
  ) VALUES (
    p_job_id,
    auth.uid(),
    v_current_phase_id,
    p_new_phase_id,
    p_change_reason
  );
  
  -- Return success
  RETURN json_build_object(
    'success', true,
    'job_id', p_job_id,
    'old_phase_id', v_current_phase_id,
    'new_phase_id', p_new_phase_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;
