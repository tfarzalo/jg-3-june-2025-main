/*
  Add is_occupied field to jobs table
  
  This allows jobs to have occupancy status set at creation time,
  which will be used when creating work orders.
*/

-- Add is_occupied column to jobs table
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS is_occupied boolean DEFAULT false;

-- Update existing jobs to default to false
UPDATE jobs
SET is_occupied = false
WHERE is_occupied IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN jobs.is_occupied IS 'Indicates if the unit is occupied. Set during job request creation and used to pre-populate work order form.';
