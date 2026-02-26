-- Check ALL jobs assigned to this subcontractor today
-- This will show us what the actual data looks like

SELECT 
  id,
  work_order_num,
  unit_number,
  current_phase_id,
  assigned_to,
  assignment_status,
  assigned_at,
  assignment_deadline,
  (created_at AT TIME ZONE 'America/New_York')::timestamp as created_at_et,
  (updated_at AT TIME ZONE 'America/New_York')::timestamp as updated_at_et,
  CASE 
    WHEN assignment_status IS NULL THEN '❌ NULL status (won''t show timer)'
    WHEN assignment_status = 'pending' AND assignment_deadline IS NOT NULL THEN '✅ Should show timer'
    WHEN assignment_status = 'pending' AND assignment_deadline IS NULL THEN '⚠️ Pending but no deadline'
    WHEN assignment_status = 'accepted' THEN '✅ Accepted (no timer needed)'
    ELSE '❓ Status: ' || assignment_status
  END as timer_status
FROM jobs
WHERE assigned_to = '17225ea2-2251-4d09-91ce-1802d20650b9'
  AND scheduled_date >= '2026-02-26'
  AND scheduled_date < '2026-02-28'
ORDER BY updated_at DESC;
