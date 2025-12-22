/*
  # Add unit size relation to jobs table

  1. Changes
    - Add unit_size_id column to jobs table with foreign key reference
    - Add index for better query performance

  2. Notes
    - Creates relation between jobs and unit sizes
    - Improves query performance with index
*/

-- Add unit_size_id to jobs table
ALTER TABLE jobs ADD COLUMN unit_size_id uuid REFERENCES unit_sizes(id);

-- Add index for better query performance
CREATE INDEX idx_jobs_unit_size_id ON jobs(unit_size_id);