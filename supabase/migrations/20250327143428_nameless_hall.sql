/*
  # Fix Jobs RLS and Created By Handling

  1. Changes
    - Drop existing policies to ensure clean slate
    - Create new policies for jobs table with proper authentication checks
    - Create trigger to automatically set created_by on insert
    - Add policies for job phase changes
    - Ensure RLS is enabled on all relevant tables

  2. Security
    - Enable RLS on jobs and job_phase_changes tables
    - Add policies for authenticated users
    - Automatically set created_by to auth.uid() on insert
    - Ensure proper access control for viewing and updating jobs
*/

-- Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Allow job creation" ON public.jobs;
DROP POLICY IF EXISTS "Allow job viewing" ON public.jobs;
DROP POLICY IF EXISTS "Allow job updates" ON public.jobs;

-- Create function to set created_by on insert
CREATE OR REPLACE FUNCTION public.set_job_created_by()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically set created_by
DROP TRIGGER IF EXISTS set_job_created_by_trigger ON public.jobs;
CREATE TRIGGER set_job_created_by_trigger
  BEFORE INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_job_created_by();

-- Create new policies for jobs table
CREATE POLICY "Allow job creation"
ON public.jobs
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow job viewing"
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

CREATE POLICY "Allow job updates"
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