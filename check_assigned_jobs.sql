-- Check the most recently assigned jobs with their full data
SELECT 
  id,
  work_order_num,
  status,
  assignment_status,
  assignment_deadline,
  (assignment_deadline AT TIME ZONE 'America/New_York')::timestamp as deadline_et,
  assigned_to,
  assigned_at,
  current_phase_id,
  (SELECT job_phase_label FROM job_phases WHERE id = jobs.current_phase_id) as phase_name
FROM jobs
WHERE assigned_to IS NOT NULL
ORDER BY 
  CASE WHEN assigned_at IS NOT NULL THEN assigned_at ELSE updated_at END DESC
LIMIT 5;

-- Show what the countdown timer is looking for:
-- assignment_status MUST be 'pending'
-- assignment_deadline MUST NOT be null
-- For dashboard: current_phase_id must be 'Job Request' phase
