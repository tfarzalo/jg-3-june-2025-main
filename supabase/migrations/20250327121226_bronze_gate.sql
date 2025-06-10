/*
  # Add RLS policies for jobs and related tables

  1. Changes
    - Enable RLS on jobs table
    - Add policies for jobs table:
      - Insert policy for authenticated users (can only set created_by to their own ID)
      - Select policy for users to view their own jobs
      - Update policy for users to modify their own jobs
    - Enable RLS on job_phases table
    - Add policy for job_phases table:
      - Select policy for all authenticated users
    - Enable RLS on job_phase_changes table
    - Add policies for job_phase_changes table:
      - Insert policy for authenticated users
      - Select policy for users to view changes on their jobs

  2. Security
    - Ensures users can only create jobs with their own ID as created_by
    - Allows users to view and update only their own jobs
    - Allows all authenticated users to view job phases
    - Allows users to track phase changes for their jobs
*/

-- Enable RLS on jobs table
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for jobs table
CREATE POLICY "Users can insert jobs for themselves"
ON public.jobs
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view their own jobs"
ON public.jobs
FOR SELECT
USING (
  created_by = auth.uid() OR 
  assigned_to = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can update their own jobs"
ON public.jobs
FOR UPDATE
USING (
  created_by = auth.uid() OR 
  assigned_to = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  created_by = auth.uid() OR 
  assigned_to = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Enable RLS on job_phases table
ALTER TABLE public.job_phases ENABLE ROW LEVEL SECURITY;

-- Create policy for job_phases table
CREATE POLICY "Authenticated users can view job phases"
ON public.job_phases
FOR SELECT
USING (auth.role() = 'authenticated');

-- Enable RLS on job_phase_changes table
ALTER TABLE public.job_phase_changes ENABLE ROW LEVEL SECURITY;

-- Create policies for job_phase_changes table
CREATE POLICY "Users can insert phase changes"
ON public.job_phase_changes
FOR INSERT
WITH CHECK (
  auth.uid() = changed_by AND
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = job_id AND (
      created_by = auth.uid() OR
      assigned_to = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  )
);

CREATE POLICY "Users can view phase changes for their jobs"
ON public.job_phase_changes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = job_id AND (
      created_by = auth.uid() OR
      assigned_to = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
      )
    )
  )
);