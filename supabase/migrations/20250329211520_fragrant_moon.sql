/*
  # Fix Job Phase Changes Foreign Key

  1. Changes
    - Remove invalid job_id references
    - Add foreign key constraint between job_phase_changes and jobs tables
    - Add index for better query performance
    - Add ON DELETE CASCADE to automatically remove phase changes when a job is deleted

  2. Security
    - Maintain existing RLS policies
*/

-- First, remove any job_phase_changes records with invalid job_id references
DELETE FROM job_phase_changes
WHERE job_id NOT IN (SELECT id FROM jobs);

-- Add foreign key constraint
ALTER TABLE job_phase_changes
ADD CONSTRAINT job_phase_changes_job_id_fkey
FOREIGN KEY (job_id)
REFERENCES jobs(id)
ON DELETE CASCADE;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_job_phase_changes_job_id 
ON job_phase_changes(job_id);