-- Test if work order timestamp and user data is already available
-- This checks what the current get_job_details function returns

-- Step 1: Get a job ID that has a work order
-- Replace 'your-job-id-here' with an actual job ID from your system
-- Or run this to find one:
SELECT j.id, j.work_order_num 
FROM jobs j 
WHERE EXISTS (
  SELECT 1 FROM work_orders wo 
  WHERE wo.job_id = j.id 
  AND wo.is_active = true
)
LIMIT 5;

-- Step 2: Check what the current function returns for work_order
-- Replace the job ID below with one from Step 1
SELECT 
  result->>'id' as job_id,
  result->>'work_order_num' as work_order_num,
  jsonb_pretty((result->'work_order')::jsonb) as work_order_data
FROM (
  SELECT get_job_details('PUT-JOB-ID-HERE'::uuid) as result
) r;

-- Step 3: Specifically check if created_at and submitted_by fields exist
SELECT 
  (result->'work_order'->>'created_at') as created_at_in_response,
  (result->'work_order'->>'submitted_by_name') as submitted_by_in_response,
  CASE 
    WHEN (result->'work_order'->>'created_at') IS NOT NULL 
    THEN '✅ created_at already exists!'
    ELSE '❌ created_at needs to be added'
  END as created_at_status,
  CASE 
    WHEN (result->'work_order'->>'submitted_by_name') IS NOT NULL 
    THEN '✅ submitted_by_name already exists!'
    ELSE '❌ submitted_by_name needs to be added'
  END as submitted_by_status
FROM (
  SELECT get_job_details('PUT-JOB-ID-HERE'::uuid) as result
) r;

-- Step 4: If fields don't exist in response, check if they exist in the actual table
SELECT 
  wo.id,
  wo.created_at as created_at_in_table,
  wo.prepared_by as prepared_by_in_table,
  p.full_name as user_name,
  p.email as user_email,
  CASE 
    WHEN wo.created_at IS NOT NULL 
    THEN '✅ Data exists in table'
    ELSE '❌ No data in table'
  END as data_status
FROM work_orders wo
LEFT JOIN profiles p ON p.id = wo.prepared_by
WHERE wo.is_active = true
LIMIT 5;
