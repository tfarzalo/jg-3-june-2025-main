/*
  # Fix Job and Phase Change Policies

  1. Changes
    - Drop all existing policies to ensure clean slate
    - Create new policies for jobs table
    - Create new policies for job phase changes
    
  2. Security
    - Enable RLS
    - Add policies for CRUD operations
    - Use auth.uid() for user identification
*/

-- Drop all existing policies to ensure clean slate
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.jobs;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.jobs;
DROP POLICY IF EXISTS "Enable update for job owners and admins" ON public.jobs;
DROP POLICY IF EXISTS "Allow authenticated users to create phase changes" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Enable phase changes for authenticated users" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Enable viewing phase changes" ON public.job_phase_changes;

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

-- Create new policies for job phase changes
CREATE POLICY "Allow phase change creation"
ON public.job_phase_changes
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow phase change viewing"
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

-- Ensure RLS is enabled on both tables
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_phase_changes ENABLE ROW LEVEL SECURITY;