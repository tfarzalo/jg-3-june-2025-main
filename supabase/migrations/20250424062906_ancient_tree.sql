-- Insert the Archived phase if it doesn't exist
INSERT INTO job_phases (job_phase_label, color_light_mode, color_dark_mode, sort_order, order_index)
SELECT 'Archived', '#D4D4D8', '#52525B', 100, 100
WHERE NOT EXISTS (
  SELECT 1 FROM job_phases WHERE job_phase_label = 'Archived'
);

-- Create index for better performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_jobs_current_phase_id ON jobs(current_phase_id);