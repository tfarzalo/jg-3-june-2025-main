/*
  # Fix Jobs and Phase Changes Policies

  1. Changes
    - Drop all existing policies before creating new ones
    - Create trigger for setting created_by
    - Add new policies for jobs table
    - Add new policies for job phase changes

  2. Security
    - Enable RLS on both tables
    - Ensure proper access control for viewing and updating jobs
    - Allow authenticated users to create jobs and phase changes
*/

-- Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Allow job creation" ON public.jobs;
DROP POLICY IF EXISTS "Allow job viewing" ON public.jobs;
DROP POLICY IF EXISTS "Allow job updates" ON public.jobs;
DROP POLICY IF EXISTS "Allow phase change creation" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Allow phase change viewing" ON public.job_phase_changes;

-- Create or replace function to set created_by on insert
CREATE OR REPLACE FUNCTION public.set_job_created_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically set created_by
DROP TRIGGER IF EXISTS set_job_created_by_trigger ON public.jobs;
CREATE TRIGGER set_job_created_by_trigger
  BEFORE INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_job_created_by();

-- Create new policies for jobs table
CREATE POLICY "Enable job creation"
ON public.jobs
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable job viewing"
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

CREATE POLICY "Enable job updates"
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

-- Ensure RLS is enabled
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Create new policies for job phase changes
CREATE POLICY "Enable phase change creation"
ON public.job_phase_changes
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable phase change viewing"
ON public.job_phase_changes
FOR SELECT
TO authenticated
USING (true);

-- Ensure RLS is enabled for job phase changes
ALTER TABLE public.job_phase_changes ENABLE ROW LEVEL SECURITY;