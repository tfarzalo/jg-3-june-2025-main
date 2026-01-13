-- Quick check: Does the current get_job_details already return timestamp data?
-- Run this in your Supabase SQL editor

-- First, let's see what a work_order object currently looks like
-- This will show you all the fields currently being returned
SELECT 
  jsonb_pretty((result->'work_order')::jsonb) as current_work_order_structure
FROM (
  SELECT get_job_details(
    (SELECT id FROM jobs WHERE id IN (
      SELECT job_id FROM work_orders WHERE is_active = true LIMIT 1
    ))
  ) as result
) r;

-- This will tell you immediately if we need to update the SQL or just the frontend!
