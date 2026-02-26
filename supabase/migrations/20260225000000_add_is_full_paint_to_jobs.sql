/*
  Add is_full_paint field to jobs table
  
  This allows jobs to have a default paint type set at creation time,
  which will be used when creating work orders.
*/

-- Add is_full_paint column to jobs table
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS is_full_paint boolean DEFAULT true;

-- Update existing jobs to default to true
UPDATE jobs
SET is_full_paint = true
WHERE is_full_paint IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN jobs.is_full_paint IS 'Indicates if the job is a full paint job (true) or partial (false). Defaults to true for new job requests.';
