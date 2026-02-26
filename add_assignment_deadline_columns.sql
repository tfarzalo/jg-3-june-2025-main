-- =====================================================
-- Step 1: Add Assignment Deadline Columns to Jobs Table
-- =====================================================
-- Run this FIRST
-- Purpose: Add columns to track job assignment deadline and status

-- Add new columns
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assignment_deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assignment_status TEXT;

-- Add check constraint for assignment_status
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS check_assignment_status;
ALTER TABLE jobs ADD CONSTRAINT check_assignment_status 
CHECK (assignment_status IN ('pending', 'accepted', 'declined', 'auto_declined'));

-- Add comments for documentation
COMMENT ON COLUMN jobs.assigned_at IS 'Timestamp when job was assigned to subcontractor (UTC, converted to ET for deadline calculation)';
COMMENT ON COLUMN jobs.assignment_deadline IS 'Deadline for subcontractor to accept/decline. Always 3:30 PM ET on the day assigned (or next business day if assigned after 3:30 PM ET)';
COMMENT ON COLUMN jobs.assignment_status IS 'Status of job assignment: pending (awaiting response), accepted, declined (manual), auto_declined (deadline expired)';

-- Update existing assigned jobs to have 'accepted' status
-- This assumes currently assigned jobs have been implicitly accepted
UPDATE jobs
SET 
  assignment_status = 'accepted',
  assigned_at = updated_at
WHERE assigned_to IS NOT NULL 
  AND assignment_status IS NULL;

-- Verify changes
SELECT 
  COUNT(*) as total_jobs,
  COUNT(assigned_at) as jobs_with_assigned_at,
  COUNT(assignment_deadline) as jobs_with_deadline,
  COUNT(assignment_status) as jobs_with_status,
  COUNT(CASE WHEN assignment_status = 'accepted' THEN 1 END) as accepted_jobs,
  COUNT(CASE WHEN assignment_status = 'pending' THEN 1 END) as pending_jobs
FROM jobs;

-- Expected result: All previously assigned jobs should now have status 'accepted'
