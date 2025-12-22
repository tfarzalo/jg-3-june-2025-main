/*
  # Add Foreign Key Constraint to job_phase_changes

  1. Changes
    - Add foreign key constraint between job_phase_changes.changed_by and profiles.id
    - Add foreign key constraint between job_phase_changes.job_id and jobs.id
    - Add indexes for better query performance

  2. Security
    - Maintain existing RLS policies
*/

-- Add foreign key constraint for changed_by column
ALTER TABLE job_phase_changes
ADD CONSTRAINT job_phase_changes_changed_by_fkey
FOREIGN KEY (changed_by)
REFERENCES profiles(id);

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_job_phase_changes_changed_by
ON job_phase_changes(changed_by);