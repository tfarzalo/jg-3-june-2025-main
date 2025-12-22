/*
  # Remove Grading Phase

  1. Changes
    - Remove the 'Grading' phase from job_phases table
    - Update any jobs that are in the Grading phase to the Work Order phase
*/

-- First, update any jobs that are in the Grading phase to the Work Order phase
UPDATE jobs
SET current_phase_id = (
  SELECT id FROM job_phases WHERE job_phase_label = 'Work Order'
)
WHERE current_phase_id IN (
  SELECT id FROM job_phases WHERE job_phase_label = 'Grading'
);

-- Update any job phase changes that reference the Grading phase
UPDATE job_phase_changes
SET to_phase_id = (
  SELECT id FROM job_phases WHERE job_phase_label = 'Work Order'
)
WHERE to_phase_id IN (
  SELECT id FROM job_phases WHERE job_phase_label = 'Grading'
);

UPDATE job_phase_changes
SET from_phase_id = (
  SELECT id FROM job_phases WHERE job_phase_label = 'Work Order'
)
WHERE from_phase_id IN (
  SELECT id FROM job_phases WHERE job_phase_label = 'Grading'
);

-- Finally, remove the Grading phase
DELETE FROM job_phases
WHERE job_phase_label = 'Grading'; 