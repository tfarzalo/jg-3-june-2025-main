-- =====================================================
-- Step 3: Create Performance Indexes
-- =====================================================
-- Run this THIRD (after create_assignment_deadline_functions.sql)
-- Purpose: Create indexes to optimize queries for assignment deadline features

-- Index 1: Find jobs with pending deadlines (most critical for auto-decline)
CREATE INDEX IF NOT EXISTS idx_jobs_assignment_deadline_pending
ON jobs(assignment_deadline) 
WHERE assignment_deadline IS NOT NULL AND assignment_status = 'pending';

COMMENT ON INDEX idx_jobs_assignment_deadline_pending IS 
'Optimizes queries for finding pending jobs with approaching or expired deadlines. Used by auto-decline cron job.';

-- Index 2: Filter jobs by assignment status
CREATE INDEX IF NOT EXISTS idx_jobs_assignment_status 
ON jobs(assignment_status) 
WHERE assignment_status IS NOT NULL;

COMMENT ON INDEX idx_jobs_assignment_status IS 
'Optimizes filtering jobs by assignment status (pending, accepted, declined, auto_declined).';

-- Index 3: Find jobs assigned to specific subcontractor with pending status
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to_status
ON jobs(assigned_to, assignment_status)
WHERE assigned_to IS NOT NULL AND assignment_status IS NOT NULL;

COMMENT ON INDEX idx_jobs_assigned_to_status IS 
'Optimizes subcontractor dashboard queries to find their pending, accepted, or declined assignments.';

-- Index 4: Track jobs by assigned_at timestamp for reporting
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_at
ON jobs(assigned_at)
WHERE assigned_at IS NOT NULL;

COMMENT ON INDEX idx_jobs_assigned_at IS 
'Optimizes reporting queries that analyze assignment patterns by time.';

-- Verify indexes created
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'jobs'
AND indexname LIKE '%assignment%'
ORDER BY indexname;

-- Success message
SELECT 'All assignment deadline indexes created successfully!' as status;
