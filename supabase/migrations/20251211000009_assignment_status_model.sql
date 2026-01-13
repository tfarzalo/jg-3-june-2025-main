/*
  # Add explicit assignment state fields to jobs

  - assignment_status: pending | accepted | declined | in_progress | completed (nullable)
  - declined_reason_code: standardized decline reasons
  - declined_reason_text: free-text when reason = other
  - assignment_decision_at: timestamp for accept/decline

  Existing assigned jobs are mapped to accepted; unassigned jobs keep status NULL.
*/

-- Add columns if they do not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'assignment_status'
  ) THEN
    ALTER TABLE jobs
      ADD COLUMN assignment_status TEXT DEFAULT 'pending';
    COMMENT ON COLUMN jobs.assignment_status IS 'Status of subcontractor assignment: pending, accepted, declined, in_progress, completed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'declined_reason_code'
  ) THEN
    ALTER TABLE jobs
      ADD COLUMN declined_reason_code TEXT;
    COMMENT ON COLUMN jobs.declined_reason_code IS 'Dropdown/code reason when a subcontractor declines an assignment';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'declined_reason_text'
  ) THEN
    ALTER TABLE jobs
      ADD COLUMN declined_reason_text TEXT;
    COMMENT ON COLUMN jobs.declined_reason_text IS 'Free-text reason when decline_reason_code is other';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'assignment_decision_at'
  ) THEN
    ALTER TABLE jobs
      ADD COLUMN assignment_decision_at TIMESTAMPTZ;
    COMMENT ON COLUMN jobs.assignment_decision_at IS 'Timestamp when subcontractor accepted or declined the assignment';
  END IF;
END $$;

-- Enforce allowed values for assignment_status while allowing NULL for unassigned jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'assignment_status_valid_values'
      AND conrelid = 'jobs'::regclass
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT assignment_status_valid_values
      CHECK (
        assignment_status IS NULL
        OR assignment_status IN ('pending', 'accepted', 'declined', 'in_progress', 'completed')
      );
  END IF;
END $$;

-- Enforce allowed values for declined_reason_code (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'declined_reason_code_valid_values'
      AND conrelid = 'jobs'::regclass
  ) THEN
    ALTER TABLE jobs
      ADD CONSTRAINT declined_reason_code_valid_values
      CHECK (
        declined_reason_code IS NULL
        OR declined_reason_code IN (
          'schedule_conflict',
          'too_far',
          'scope_mismatch',
          'rate_issue',
          'other'
        )
      );
  END IF;
END $$;

-- Map existing data:
-- - Any job currently assigned → accepted
-- - Unassigned jobs keep assignment_status NULL to avoid implying pending
UPDATE jobs
SET assignment_status = CASE
  WHEN assigned_to IS NOT NULL THEN 'accepted'
  ELSE NULL
END
WHERE assignment_status IS NULL;

