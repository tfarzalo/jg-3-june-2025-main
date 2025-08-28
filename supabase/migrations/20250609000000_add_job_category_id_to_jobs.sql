-- Add job_category_id to jobs table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'job_category_id'
  ) THEN
    ALTER TABLE jobs 
    ADD COLUMN job_category_id uuid REFERENCES job_categories(id);
  END IF;
END $$;

-- Add index for better query performance (only if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_jobs_job_category_id ON jobs(job_category_id);

-- Drop the existing function first to avoid conflicts
DROP FUNCTION IF EXISTS create_job(uuid, text, uuid, uuid, text, date);
DROP FUNCTION IF EXISTS create_job(uuid, text, uuid, uuid, uuid, text, date);

-- Create the new function that handles job_category_id
CREATE OR REPLACE FUNCTION create_job(
  p_property_id uuid,
  p_unit_number text,
  p_unit_size_id uuid,
  p_job_type_id uuid,
  p_description text DEFAULT '',
  p_scheduled_date date DEFAULT CURRENT_DATE,
  p_job_category_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_job_phase_id uuid;
  v_job_details json;
BEGIN
  -- Get the "Job Request" phase ID
  SELECT id INTO v_job_phase_id
  FROM job_phases
  WHERE job_phase_label = 'Job Request';

  IF v_job_phase_id IS NULL THEN
    RAISE EXCEPTION 'Job Request phase not found';
  END IF;

  -- Insert the job
  INSERT INTO jobs (
    property_id,
    unit_number,
    unit_size_id,
    job_type_id,
    job_category_id,
    description,
    scheduled_date,
    created_by,
    status
  ) VALUES (
    p_property_id,
    p_unit_number,
    p_unit_size_id,
    p_job_type_id,
    p_job_category_id,
    p_description,
    p_scheduled_date,
    auth.uid(),
    'Open'
  )
  RETURNING id INTO v_job_id;

  -- Create the initial phase change
  INSERT INTO job_phase_changes (
    job_id,
    changed_by,
    from_phase_id,
    to_phase_id,
    change_reason
  ) VALUES (
    v_job_id,
    auth.uid(),
    NULL,
    v_job_phase_id,
    'Initial job request creation'
  );

  -- Get full job details
  SELECT json_build_object(
    'id', j.id,
    'work_order_num', j.work_order_num,
    'property_id', j.property_id,
    'unit_number', j.unit_number,
    'unit_size_id', j.unit_size_id,
    'job_type_id', j.job_type_id,
    'job_category_id', j.job_category_id,
    'description', j.description,
    'scheduled_date', j.scheduled_date,
    'status', j.status,
    'created_by', j.created_by,
    'current_phase_id', j.current_phase_id,
    'created_at', j.created_at,
    'updated_at', j.updated_at
  ) INTO v_job_details
  FROM jobs j
  WHERE j.id = v_job_id;

  RETURN v_job_details;
END;
$$;
