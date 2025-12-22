-- All-in-one check: Does get_job_details already return timestamp and user data?
-- This automatically finds a job with a work order and checks it

WITH sample_job AS (
  SELECT j.id as job_id, j.work_order_num
  FROM jobs j 
  WHERE EXISTS (
    SELECT 1 FROM work_orders wo 
    WHERE wo.job_id = j.id 
    AND wo.is_active = true
  )
  LIMIT 1
),
job_details AS (
  SELECT get_job_details(job_id) as result
  FROM sample_job
)
SELECT 
  '=== CURRENT WORK ORDER STRUCTURE ===' as section,
  jsonb_pretty((result->'work_order')::jsonb) as work_order_json,
  '' as separator,
  '=== FIELD CHECK ===' as check_section,
  CASE 
    WHEN (result->'work_order'->>'created_at') IS NOT NULL 
    THEN '✅ created_at EXISTS in response'
    ELSE '❌ created_at MISSING - need SQL update'
  END as created_at_status,
  CASE 
    WHEN (result->'work_order'->>'submitted_by_name') IS NOT NULL 
    THEN '✅ submitted_by_name EXISTS in response'
    ELSE '❌ submitted_by_name MISSING - need SQL update'
  END as submitted_by_status,
  CASE 
    WHEN (result->'work_order'->>'created_at') IS NOT NULL 
     AND (result->'work_order'->>'submitted_by_name') IS NOT NULL 
    THEN '🎉 ALL DATA EXISTS - Just update frontend!'
    ELSE '⚠️  Need to apply SQL update first'
  END as conclusion
FROM job_details;
