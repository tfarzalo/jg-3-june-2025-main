-- Create function to update job unit size with RLS bypass for subcontractors
CREATE OR REPLACE FUNCTION update_job_unit_size(
  p_job_id UUID,
  p_unit_size_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE jobs
  SET 
    unit_size_id = p_unit_size_id,
    updated_at = NOW()
  WHERE id = p_job_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Job not found');
  END IF;
  
  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;
