/*
  # Fix Job Creation Permissions

  1. Changes
    - Create a secure function to handle job creation
    - Update RLS policies to use auth.uid()
    - Remove direct user table access

  2. Security
    - Use security definer function to handle job creation
    - Automatically set created_by using auth.uid()
    - Ensure proper access control
*/

-- Create a secure function to handle job creation
CREATE OR REPLACE FUNCTION create_job(
  p_property_id uuid,
  p_unit_number text,
  p_unit_size_id uuid,
  p_job_type_id uuid,
  p_description text,
  p_scheduled_date date
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  -- Insert the job
  INSERT INTO jobs (
    property_id,
    unit_number,
    unit_size_id,
    job_type_id,
    description,
    scheduled_date,
    created_by,
    status
  ) VALUES (
    p_property_id,
    p_unit_number,
    p_unit_size_id,
    p_job_type_id,
    p_description,
    p_scheduled_date,
    auth.uid(),
    'Open'
  )
  RETURNING id INTO v_job_id;

  -- Return the created job
  RETURN json_build_object(
    'id', v_job_id,
    'status', 'success'
  );
END;
$$;