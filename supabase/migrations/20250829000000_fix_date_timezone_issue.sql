/*
  # Fix Date Timezone Issue in Job Creation

  1. Problem
    - Schedule Work Date is showing yesterday instead of today
    - Date changes are not being saved properly
    - Timezone conversion is causing date shifts

  2. Solution
    - Update create_job function to properly handle timezone conversion
    - Ensure dates are stored at midnight Eastern Time
    - Fix the ensure_eastern_time trigger to handle date-only inputs correctly
*/

-- First, let's check what the current create_job function looks like
-- and update it to properly handle timezone conversion

-- Drop the existing function
DROP FUNCTION IF EXISTS create_job(uuid, text, uuid, uuid, text, date, uuid);

-- Create the updated function with proper timezone handling
CREATE OR REPLACE FUNCTION create_job(
  p_property_id uuid,
  p_unit_number text,
  p_unit_size_id uuid,
  p_job_type_id uuid,
  p_description text,
  p_scheduled_date date,
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
  v_user_id uuid;
  v_scheduled_date timestamptz;
BEGIN
  -- Try to get the current user ID, fall back to system user if not available
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    -- Get the first admin user as system user
    SELECT id INTO v_user_id 
    FROM auth.users 
    WHERE role = 'admin' 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF v_user_id IS NULL THEN
      -- If no admin user found, try to get any user
      SELECT id INTO v_user_id 
      FROM auth.users 
      ORDER BY created_at ASC 
      LIMIT 1;
      
      IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'No system user found for job creation';
      END IF;
    END IF;
  END;

  -- Convert the date to Eastern Time midnight
  -- This ensures the date is stored consistently regardless of the user's timezone
  v_scheduled_date := (p_scheduled_date::text || ' 00:00:00 America/New_York')::timestamptz;

  -- Debug log the date conversion
  RAISE NOTICE 'Date conversion: % -> %', p_scheduled_date, v_scheduled_date;

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
    job_category_id,
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
    p_job_category_id,
    p_description,
    v_scheduled_date,
    v_user_id,
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
    v_user_id,
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
    'job_category', CASE 
      WHEN j.job_category_id IS NOT NULL THEN json_build_object(
        'id', jc.id,
        'name', jc.name
      )
      ELSE NULL
    END,
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
  LEFT JOIN job_categories jc ON jc.id = j.job_category_id
  WHERE j.id = v_job_id;

  RETURN v_job_details;
END;
$$;

-- Update the ensure_eastern_time trigger function to handle date-only inputs better
CREATE OR REPLACE FUNCTION ensure_eastern_time()
RETURNS trigger AS $$
BEGIN
  -- If the scheduled_date is not null, ensure it's properly converted to Eastern Time
  IF NEW.scheduled_date IS NOT NULL THEN
    -- If it's already a timestamptz, make sure it's at midnight Eastern Time
    -- If it's a date, convert it to midnight Eastern Time
    NEW.scheduled_date := (NEW.scheduled_date::date || ' 00:00:00 America/New_York')::timestamptz;
    
    -- Debug log the conversion
    RAISE NOTICE 'Trigger: Converting scheduled_date to %', NEW.scheduled_date;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS ensure_eastern_time_trigger ON jobs;
CREATE TRIGGER ensure_eastern_time_trigger
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION ensure_eastern_time();

-- Add a function to test date conversion
CREATE OR REPLACE FUNCTION test_date_conversion(test_date date)
RETURNS text AS $$
DECLARE
  converted_date timestamptz;
BEGIN
  converted_date := (test_date::text || ' 00:00:00 America/New_York')::timestamptz;
  RETURN 'Input: ' || test_date || ' -> Output: ' || converted_date || ' (Eastern: ' || converted_date AT TIME ZONE 'America/New_York' || ')';
END;
$$ LANGUAGE plpgsql;

-- Test the date conversion
SELECT test_date_conversion(CURRENT_DATE);
