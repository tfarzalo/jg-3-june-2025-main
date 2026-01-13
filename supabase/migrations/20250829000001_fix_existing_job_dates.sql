/*
  # Fix Existing Job Dates

  1. Problem
    - Existing jobs may have incorrect scheduled_date values due to timezone issues
    - Need to update existing records to ensure they display correctly

  2. Solution
    - Update existing job dates to be stored at midnight Eastern Time
    - Ensure all dates are consistent with the new timezone handling
*/

-- First, let's see what the current date values look like
SELECT 
  id,
  scheduled_date,
  scheduled_date AT TIME ZONE 'America/New_York' as eastern_date,
  DATE(scheduled_date AT TIME ZONE 'America/New_York') as eastern_date_only
FROM jobs 
ORDER BY created_at DESC 
LIMIT 10;

-- Update existing jobs to ensure their scheduled_date is at midnight Eastern Time
-- This will fix any dates that were stored incorrectly
UPDATE jobs 
SET scheduled_date = (DATE(scheduled_date AT TIME ZONE 'America/New_York') || ' 00:00:00 America/New_York')::timestamptz
WHERE scheduled_date IS NOT NULL;

-- Verify the fix worked
SELECT 
  id,
  scheduled_date,
  scheduled_date AT TIME ZONE 'America/New_York' as eastern_date,
  DATE(scheduled_date AT TIME ZONE 'America/New_York') as eastern_date_only
FROM jobs 
ORDER BY created_at DESC 
LIMIT 10;

-- Add a function to help debug date issues
CREATE OR REPLACE FUNCTION debug_job_date(job_id uuid)
RETURNS TABLE(
  job_id uuid,
  original_date timestamptz,
  eastern_date timestamptz,
  eastern_date_only date,
  formatted_display text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.id,
    j.scheduled_date,
    j.scheduled_date AT TIME ZONE 'America/New_York',
    DATE(j.scheduled_date AT TIME ZONE 'America/New_York'),
    TO_CHAR(j.scheduled_date AT TIME ZONE 'America/New_York', 'MMM DD, YYYY')
  FROM jobs j
  WHERE j.id = job_id;
END;
$$ LANGUAGE plpgsql;

-- Test the debug function
SELECT * FROM debug_job_date(
  (SELECT id FROM jobs ORDER BY created_at DESC LIMIT 1)
);
