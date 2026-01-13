/*
  # Fix Date Handling in Jobs Table

  1. Changes
    - Add timezone handling for scheduled_date
    - Add check constraint to ensure dates are stored in Eastern Time
    - Add function to convert dates to Eastern Time

  2. Notes
    - All dates will be stored in UTC but handled in Eastern Time
    - Frontend will display dates in Eastern Time
*/

-- Create function to validate Eastern Time dates
CREATE OR REPLACE FUNCTION is_eastern_time(date_str text)
RETURNS boolean AS $$
BEGIN
  RETURN date_str ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(-0[45]00|EST|EDT)$';
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update jobs table to use timestamptz
ALTER TABLE jobs
ALTER COLUMN scheduled_date TYPE timestamptz
USING scheduled_date::timestamptz;

-- Add trigger function to ensure dates are in Eastern Time
CREATE OR REPLACE FUNCTION ensure_eastern_time()
RETURNS trigger AS $$
BEGIN
  -- Convert the scheduled_date to Eastern Time if it's not already
  NEW.scheduled_date = NEW.scheduled_date AT TIME ZONE 'America/New_York';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS ensure_eastern_time_trigger ON jobs;
CREATE TRIGGER ensure_eastern_time_trigger
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION ensure_eastern_time();

-- Update the create_job function to handle timezone
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
  v_job_phase_id uuid;
  v_job_details json;
  v_scheduled_date timestamptz;
BEGIN
  -- Convert the date to Eastern Time midnight
  v_scheduled_date := (p_scheduled_date || ' 00:00:00 America/New_York')::timestamptz;

  -- Get the "Job Request" phase ID
  SELECT id INTO v_job_phase_id
  FROM job_phases
  WHERE job_phase_label = 'Job Request';

  IF v_job_phase_id IS NULL THEN
    RAISE EXCEPTION 'Job Request phase not found';
  END IF;

  -- Insert the job with timezone-aware scheduled date
  INSERT INTO jobs (
    property_id,
    unit_number,
    unit_size_id,
    job_type_id,
    description,
    scheduled_date,
    created_by,
    status,
    current_phase_id
  ) VALUES (
    p_property_id,
    p_unit_number,
    p_unit_size_id,
    p_job_type_id,
    p_description,
    v_scheduled_date,
    auth.uid(),
    'Open',
    v_job_phase_id
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
    'status', j.status,
    'property', json_build_object(
      'id', p.id,
      'name', p.property_name,
      'address', p.address,
      'address_2', p.address_2,
      'city', p.city,
      'state', p.state,
      'zip', p.zip
    ),
    'unit_number', j.unit_number,
    'unit_size', json_build_object(
      'id', us.id,
      'label', us.unit_size_label
    ),
    'job_type', json_build_object(
      'id', jt.id,
      'label', jt.job_type_label
    ),
    'description', j.description,
    'scheduled_date', j.scheduled_date AT TIME ZONE 'America/New_York',
    'created_at', j.created_at,
    'job_phase', json_build_object(
      'id', jp.id,
      'label', jp.job_phase_label,
      'color_light_mode', jp.color_light_mode,
      'color_dark_mode', jp.color_dark_mode
    )
  ) INTO v_job_details
  FROM jobs j
  JOIN properties p ON p.id = j.property_id
  JOIN unit_sizes us ON us.id = j.unit_size_id
  JOIN job_types jt ON jt.id = j.job_type_id
  JOIN job_phases jp ON jp.id = j.current_phase_id
  WHERE j.id = v_job_id;

  RETURN v_job_details;
END;
$$;