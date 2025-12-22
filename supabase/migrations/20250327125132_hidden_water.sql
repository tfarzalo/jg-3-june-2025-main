/*
  # Fix Job Creation Permissions

  1. Changes
    - Drop existing problematic policies
    - Add new policies for jobs table
    - Update job phase changes policies
    - Ensure proper access control based on user roles

  2. Security
    - Enable proper RLS policies for jobs table
    - Allow authenticated users to create jobs
    - Allow users to view and update their own jobs
    - Grant admin users full access
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can insert jobs for themselves" ON public.jobs;
DROP POLICY IF EXISTS "Users can view their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.jobs;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.jobs;
DROP POLICY IF EXISTS "Enable update for job owners and admins" ON public.jobs;
DROP POLICY IF EXISTS "Allow authenticated inserts" ON public.jobs;
DROP POLICY IF EXISTS "Allow authenticated users to create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow users to update their jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow users to view their jobs" ON public.jobs;

-- Create new policies for jobs table
CREATE POLICY "Enable insert for authenticated users only"
ON public.jobs
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable read access for authenticated users"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() OR 
  assigned_to = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Enable update for job owners and admins"
ON public.jobs
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid() OR 
  assigned_to = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  created_by = auth.uid() OR 
  assigned_to = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Drop and recreate job phase changes policies
DROP POLICY IF EXISTS "Users can insert phase changes" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Users can view phase changes for their jobs" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Allow authenticated users to create phase changes" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Enable phase changes for authenticated users" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Enable viewing phase changes" ON public.job_phase_changes;

CREATE POLICY "Enable phase changes for authenticated users"
ON public.job_phase_changes
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable viewing phase changes"
ON public.job_phase_changes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM jobs
    WHERE id = job_id AND (
      created_by = auth.uid() OR
      assigned_to = auth.uid() OR
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  )
);