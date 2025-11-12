/*
  # Fix Calendar Date Display

  1. Changes
    - Add function to properly compare dates in Eastern Time
    - Add function to debug date timezone issues
    - Ensure consistent date handling across the application

  2. Security
    - Maintain existing RLS policies
*/

-- Create a function to compare dates in Eastern Time
CREATE OR REPLACE FUNCTION is_same_day_eastern(date1 timestamptz, date2 timestamptz)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN (date1 AT TIME ZONE 'America/New_York')::date = 
         (date2 AT TIME ZONE 'America/New_York')::date;
END;
$$;

-- Create a function to get jobs for a specific day in Eastern Time
CREATE OR REPLACE FUNCTION get_jobs_for_day(p_date date)
RETURNS TABLE (
  id uuid,
  work_order_num integer,
  unit_number text,
  scheduled_date timestamptz,
  property_name text,
  job_phase_label text,
  job_phase_color text,
  job_type_label text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_time timestamptz;
  v_end_time timestamptz;
BEGIN
  -- Convert the input date to start and end timestamps in Eastern Time
  v_start_time := (p_date::text || ' 00:00:00 America/New_York')::timestamptz;
  v_end_time := (p_date::text || ' 23:59:59 America/New_York')::timestamptz;
  
  RETURN QUERY
  SELECT 
    j.id,
    j.work_order_num,
    j.unit_number,
    j.scheduled_date,
    p.property_name,
    jp.job_phase_label,
    jp.color_dark_mode,
    jt.job_type_label
  FROM jobs j
  JOIN properties p ON j.property_id = p.id
  JOIN job_phases jp ON j.current_phase_id = jp.id
  JOIN job_types jt ON j.job_type_id = jt.id
  WHERE j.scheduled_date >= v_start_time
    AND j.scheduled_date <= v_end_time;
END;
$$;

-- Create a function to get jobs for a month in Eastern Time
CREATE OR REPLACE FUNCTION get_jobs_for_month(p_year integer, p_month integer)
RETURNS TABLE (
  id uuid,
  work_order_num integer,
  unit_number text,
  scheduled_date timestamptz,
  property_name text,
  job_phase_label text,
  job_phase_color text,
  job_type_label text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date date;
  v_end_date date;
  v_start_time timestamptz;
  v_end_time timestamptz;
BEGIN
  -- Calculate the start and end dates of the month
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := (v_start_date + interval '1 month' - interval '1 day')::date;
  
  -- Convert to timestamptz in Eastern Time
  v_start_time := (v_start_date::text || ' 00:00:00 America/New_York')::timestamptz;
  v_end_time := (v_end_date::text || ' 23:59:59 America/New_York')::timestamptz;
  
  RETURN QUERY
  SELECT 
    j.id,
    j.work_order_num,
    j.unit_number,
    j.scheduled_date,
    p.property_name,
    jp.job_phase_label,
    jp.color_dark_mode,
    jt.job_type_label
  FROM jobs j
  JOIN properties p ON j.property_id = p.id
  JOIN job_phases jp ON j.current_phase_id = jp.id
  JOIN job_types jt ON j.job_type_id = jt.id
  WHERE j.scheduled_date >= v_start_time
    AND j.scheduled_date <= v_end_time;
END;
$$;

-- Create a function to debug date timezone issues
CREATE OR REPLACE FUNCTION debug_date(p_date timestamptz)
RETURNS json
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN json_build_object(
    'input', p_date,
    'utc', p_date AT TIME ZONE 'UTC',
    'eastern', p_date AT TIME ZONE 'America/New_York',
    'eastern_date', (p_date AT TIME ZONE 'America/New_York')::date,
    'utc_date', (p_date AT TIME ZONE 'UTC')::date
  );
END;
$$;