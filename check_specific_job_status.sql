-- Check the specific job's assignment status and deadline
-- Run this in Supabase SQL Editor to see if the job has the required fields

SELECT 
  id,
  work_order_num,
  assigned_to,
  assignment_status,
  (assigned_at AT TIME ZONE 'America/New_York')::timestamp as assigned_at_et,
  (assignment_deadline AT TIME ZONE 'America/New_York')::timestamp as deadline_et,
  (created_at AT TIME ZONE 'America/New_York')::timestamp as created_at_et,
  (updated_at AT TIME ZONE 'America/New_York')::timestamp as updated_at_et,
  CASE 
    WHEN assignment_status IS NULL THEN '❌ Missing assignment_status'
    WHEN assignment_deadline IS NULL THEN '❌ Missing assignment_deadline'
    WHEN assignment_deadline < NOW() THEN '⚠️ EXPIRED'
    ELSE '✅ Active - ' || EXTRACT(EPOCH FROM (assignment_deadline - NOW()))/3600 || ' hours remaining'
  END as countdown_status
FROM jobs
WHERE assigned_to = '17225ea2-2251-4d09-91ce-1802d20650b9'  -- Your subcontractor user ID
  AND scheduled_date >= CURRENT_DATE
  AND scheduled_date <= CURRENT_DATE + INTERVAL '1 day'
ORDER BY scheduled_date;
