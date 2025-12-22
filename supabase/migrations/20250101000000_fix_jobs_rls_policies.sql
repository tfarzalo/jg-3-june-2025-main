-- Fix Jobs RLS Policies for Proper Role-Based Access
-- Migration: 20250101000000_fix_jobs_rls_policies.sql
-- This script fixes the issue where jg_management users cannot see all jobs

-- Drop existing policies to ensure clean slate
DROP POLICY IF EXISTS "Allow job creation" ON public.jobs;
DROP POLICY IF EXISTS "Allow job viewing" ON public.jobs;
DROP POLICY IF EXISTS "Allow job updates" ON public.jobs;

-- Create new policies for jobs table with proper role handling
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
  -- Admin and JG Management users can see ALL jobs
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
  )
  OR
  -- Regular users can see jobs they created or are assigned to
  created_by = auth.uid() OR 
  assigned_to = auth.uid()
);

CREATE POLICY "Allow job updates"
ON public.jobs
FOR UPDATE
TO authenticated
USING (
  -- Admin and JG Management users can update ALL jobs
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
  )
  OR
  -- Regular users can update jobs they created or are assigned to
  created_by = auth.uid() OR 
  assigned_to = auth.uid()
)
WITH CHECK (
  -- Admin and JG Management users can update ALL jobs
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
  )
  OR
  -- Regular users can update jobs they created or are assigned to
  created_by = auth.uid() OR 
  assigned_to = auth.uid()
);

-- Ensure RLS is enabled
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
