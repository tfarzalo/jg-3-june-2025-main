-- Fix: Set assignment_deadline for pending jobs
-- This will set deadline to 3:30 PM ET today (or tomorrow if after 3:30 PM)

-- Fix WO-2663 (first job)
UPDATE jobs
SET 
  assignment_deadline = calculate_assignment_deadline(NOW()),
  assigned_at = NOW()
WHERE id = '0f527077-ea4e-483e-b171-1bccf79ef150';

-- Fix WO-2588 (second job)
UPDATE jobs
SET 
  assignment_deadline = calculate_assignment_deadline(NOW()),
  assigned_at = NOW()
WHERE id = '4c6b0458-0724-4e7d-8a91-e107d8bb3f78';

-- OR fix all pending jobs at once
UPDATE jobs
SET 
  assignment_deadline = calculate_assignment_deadline(NOW()),
  assigned_at = COALESCE(assigned_at, NOW())
WHERE assignment_status = 'pending'
AND assignment_deadline IS NULL;

-- Verify the fix
SELECT 
  work_order_num,
  assignment_status,
  assignment_deadline,
  (assignment_deadline AT TIME ZONE 'America/New_York')::timestamp as deadline_et,
  EXTRACT(HOUR FROM (assignment_deadline AT TIME ZONE 'America/New_York')::timestamp) as deadline_hour,
  EXTRACT(MINUTE FROM (assignment_deadline AT TIME ZONE 'America/New_York')::timestamp) as deadline_minute
FROM jobs
WHERE assignment_status = 'pending'
AND assignment_deadline IS NOT NULL
ORDER BY work_order_num;

-- Expected result: deadline_hour = 15, deadline_minute = 30 (3:30 PM ET)
