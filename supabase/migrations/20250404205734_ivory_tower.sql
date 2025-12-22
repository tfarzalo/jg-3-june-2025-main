/*
  # Fix Date Handling in Jobs Table

  1. Changes
    - Update ensure_eastern_time function to properly handle date conversions
    - Fix timezone handling in create_job function
    - Ensure dates are consistently stored and retrieved

  2. Security
    - Maintain existing RLS policies
*/

-- Update the function to ensure dates are properly handled in Eastern Time
CREATE OR REPLACE FUNCTION ensure_eastern_time()
RETURNS trigger AS $$
BEGIN
  -- If the scheduled_date is a date-only string, convert it to a timestamptz at midnight Eastern Time
  IF NEW.scheduled_date IS NOT NULL THEN
    -- Make sure we're storing the date at midnight Eastern Time
    -- This ensures consistent date handling regardless of the user's timezone
    NEW.scheduled_date = (NEW.scheduled_date::date || ' 00:00:00 America/New_York')::timestamptz;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the create_job function to handle timezone conversion properly
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
  -- This ensures the date is stored consistently regardless of the user's timezone
  v_scheduled_date := (p_scheduled_date::text || ' 00:00:00 America/New_York')::timestamptz;

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
    'scheduled_date', j.scheduled_date,
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

-- Create a function to format dates in Eastern Time for display
CREATE OR REPLACE FUNCTION format_eastern_date(input_date timestamptz)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_char(input_date AT TIME ZONE 'America/New_York', 'YYYY-MM-DD');
$$;

-- Create a function to get a date in Eastern Time
CREATE OR REPLACE FUNCTION get_eastern_date()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (now() AT TIME ZONE 'America/New_York')::date;
$$;