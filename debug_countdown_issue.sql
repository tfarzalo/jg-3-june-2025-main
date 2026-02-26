-- Check if assignment_deadline column exists and has data
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'jobs'
AND column_name LIKE '%assignment%'
ORDER BY column_name;

-- Check if any jobs have assignment_deadline set
SELECT 
  id,
  work_order_num,
  status,
  assigned_to,
  assignment_status,
  assignment_deadline,
  assigned_at
FROM jobs
WHERE assignment_deadline IS NOT NULL
LIMIT 5;

-- Check the job you just assigned
SELECT 
  id,
  work_order_num,
  status,
  assigned_to,
  assignment_status,
  assignment_deadline,
  (assignment_deadline AT TIME ZONE 'America/New_York')::timestamp as deadline_et,
  current_phase_id
FROM jobs
WHERE assigned_to IS NOT NULL
AND assignment_deadline IS NOT NULL
ORDER BY assigned_at DESC
LIMIT 3;
