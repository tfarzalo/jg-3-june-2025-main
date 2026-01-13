/*
  # Add delete policies for jobs and job phase changes

  1. Changes
    - Add policy to allow deletion of jobs in "Job Request" phase
    - Add policy to allow deletion of related job phase changes
    - Add policy to allow deletion of archived jobs
    - Add function to handle job deletion with proper permissions
    - Ensure proper access control based on user roles

  2. Security
    - Only allow deletion of jobs in "Job Request" phase
    - Allow deletion of related job phase changes
    - Allow deletion of archived jobs by admins
    - Restrict deletion to job owners and admins
*/

-- Add delete policy for jobs
CREATE POLICY "Enable deletion of jobs in Job Request phase"
ON jobs
FOR DELETE
TO authenticated
USING (
  current_phase_id IN (
    SELECT id FROM job_phases WHERE job_phase_label = 'Job Request'
  ) AND (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Add policy to allow deletion of archived jobs
CREATE POLICY "Enable deletion of archived jobs"
ON jobs
FOR DELETE
TO authenticated
USING (
  current_phase_id IN (
    SELECT id FROM job_phases WHERE job_phase_label = 'Archived'
  ) AND (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Add delete policy for job phase changes
CREATE POLICY "Enable deletion of job phase changes"
ON job_phase_changes
FOR DELETE
TO authenticated
USING (
  job_id IN (
    SELECT id FROM jobs
    WHERE current_phase_id IN (
      SELECT id FROM job_phases WHERE job_phase_label = 'Job Request'
    )
  ) AND (
    changed_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
);

-- Create function to delete jobs with proper permissions
CREATE OR REPLACE FUNCTION delete_jobs(job_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  job_owner boolean;
  job_phase text;
BEGIN
  -- Check if user is admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) INTO is_admin;

  -- For each job, verify permissions and phase
  FOR job_id IN SELECT unnest(job_ids)
  LOOP
    -- Check if user is the job owner
    SELECT EXISTS (
      SELECT 1 FROM jobs
      WHERE id = job_id AND created_by = auth.uid()
    ) INTO job_owner;

    -- Check job phase
    SELECT jp.job_phase_label INTO job_phase
    FROM jobs j
    JOIN job_phases jp ON j.current_phase_id = jp.id
    WHERE j.id = job_id;

    -- Verify permissions
    IF NOT (is_admin OR job_owner) THEN
      RAISE EXCEPTION 'You do not have permission to delete this job';
    END IF;

    -- Verify phase
    IF job_phase != 'Archived' THEN
      RAISE EXCEPTION 'Only archived jobs can be deleted';
    END IF;
  END LOOP;

  -- Delete in the correct order to maintain referential integrity
  -- 1. Delete work orders first (no cascade)
  DELETE FROM work_orders
  WHERE job_id = ANY(job_ids);

  -- 2. Delete files associated with the jobs (no cascade)
  DELETE FROM files
  WHERE job_id = ANY(job_ids);

  -- 3. Delete the jobs themselves
  DELETE FROM jobs
  WHERE id = ANY(job_ids);
END;
$$;