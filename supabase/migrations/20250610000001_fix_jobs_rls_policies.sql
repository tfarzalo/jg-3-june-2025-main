/*
  # Fix Jobs Table RLS Policies - Comprehensive Cleanup

  1. Problem
    - Multiple conflicting RLS policies across different migrations
    - Inconsistent access control causing job creation failures
    - Mixed policy names and logic creating security gaps

  2. Solution
    - Drop ALL existing conflicting policies
    - Create clean, consistent policies for jobs table
    - Ensure proper role-based access control
    - Fix job creation permissions
*/

-- ========================================
-- JOBS TABLE - Clean RLS Policies
-- ========================================

-- Drop ALL existing policies to ensure clean slate
DROP POLICY IF EXISTS "Allow job creation" ON public.jobs;
DROP POLICY IF EXISTS "Allow job viewing" ON public.jobs;
DROP POLICY IF EXISTS "Allow job updates" ON public.jobs;
DROP POLICY IF EXISTS "Enable job creation" ON public.jobs;
DROP POLICY IF EXISTS "Enable job viewing" ON public.jobs;
DROP POLICY IF EXISTS "Enable job updates" ON public.jobs;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.jobs;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.jobs;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.jobs;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.jobs;
DROP POLICY IF EXISTS "Enable update for job owners and admins" ON public.jobs;
DROP POLICY IF EXISTS "Users can insert jobs for themselves" ON public.jobs;
DROP POLICY IF EXISTS "Users can view their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Authenticated users can create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Allow authenticated users to create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can view their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "jobs_read_all" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_auth" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_own" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_admin" ON public.jobs;
DROP POLICY IF EXISTS "Jobs full access for admin/management" ON public.jobs;
DROP POLICY IF EXISTS "Jobs limited access for subcontractors" ON public.jobs;
-- Also drop the policies we're about to create to avoid conflicts
DROP POLICY IF EXISTS "jobs_insert_authenticated" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_role_based" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_role_based" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_admin_only" ON public.jobs;

-- Ensure RLS is enabled
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Create clean, consistent policies for jobs table
CREATE POLICY "jobs_insert_authenticated"
ON public.jobs
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "jobs_select_role_based"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  -- Admin and JG Management users can see ALL jobs
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
  )
  OR
  -- Regular users can see jobs they created or are assigned to
  created_by = auth.uid() OR 
  assigned_to = auth.uid()
);

CREATE POLICY "jobs_update_role_based"
ON public.jobs
FOR UPDATE
TO authenticated
USING (
  -- Admin and JG Management users can update ALL jobs
  EXISTS (
    SELECT 1 FROM public.profiles
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
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
  )
  OR
  -- Regular users can update jobs they created or are assigned to
  created_by = auth.uid() OR 
  assigned_to = auth.uid()
);

CREATE POLICY "jobs_delete_admin_only"
ON public.jobs
FOR DELETE
TO authenticated
USING (
  -- Only admins can delete jobs
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ========================================
-- JOB_PHASES TABLE - Clean RLS Policies
-- ========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view job phases" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_read_all" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_insert_auth" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_update_auth" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_delete_auth" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_select_all" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_insert_admin" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_update_admin" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_delete_admin" ON public.job_phases;
-- Also drop the policies we're about to create
DROP POLICY IF EXISTS "job_phases_select_authenticated" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_modify_admin_only" ON public.job_phases;

-- Ensure RLS is enabled
ALTER TABLE public.job_phases ENABLE ROW LEVEL SECURITY;

-- Create clean policies for job_phases table
CREATE POLICY "job_phases_select_authenticated"
ON public.job_phases
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "job_phases_modify_admin_only"
ON public.job_phases
FOR ALL
TO authenticated
USING (
  -- Only admins and JG Management can modify job phases
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
  )
)
WITH CHECK (
  -- Only admins and JG Management can modify job phases
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
  )
);

-- ========================================
-- JOB_PHASE_CHANGES TABLE - Clean RLS Policies
-- ========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow phase change creation" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Allow phase change viewing" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Users can insert phase changes" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Users can view phase changes for their jobs" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Allow authenticated users to create phase changes" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Enable phase changes for authenticated users" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Enable viewing phase changes" ON public.job_phase_changes;
-- Also drop the policies we're about to create
DROP POLICY IF EXISTS "job_phase_changes_insert_authenticated" ON public.job_phase_changes;
DROP POLICY IF EXISTS "job_phase_changes_select_role_based" ON public.job_phase_changes;

-- Ensure RLS is enabled
ALTER TABLE public.job_phase_changes ENABLE ROW LEVEL SECURITY;

-- Create clean policies for job_phase_changes table
CREATE POLICY "job_phase_changes_insert_authenticated"
ON public.job_phase_changes
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "job_phase_changes_select_role_based"
ON public.job_phase_changes
FOR SELECT
TO authenticated
USING (
  -- Admin and JG Management users can see ALL phase changes
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
  )
  OR
  -- Regular users can see phase changes for jobs they have access to
  EXISTS (
    SELECT 1 FROM public.jobs
    WHERE id = job_phase_changes.job_id
    AND (created_by = auth.uid() OR assigned_to = auth.uid())
  )
);

-- ========================================
-- PROPERTIES TABLE - Clean RLS Policies
-- ========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Properties full access for admin/management" ON public.properties;
DROP POLICY IF EXISTS "Properties read for subcontractors" ON public.properties;
DROP POLICY IF EXISTS "properties_select_all" ON public.properties;
DROP POLICY IF EXISTS "properties_insert_admin" ON public.properties;
DROP POLICY IF EXISTS "properties_update_admin" ON public.properties;
DROP POLICY IF EXISTS "properties_delete_admin" ON public.properties;
-- Also drop the policies we're about to create
DROP POLICY IF EXISTS "properties_select_authenticated" ON public.properties;
DROP POLICY IF EXISTS "properties_modify_admin_only" ON public.properties;

-- Ensure RLS is enabled
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Create clean policies for properties table
CREATE POLICY "properties_select_authenticated"
ON public.properties
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "properties_modify_admin_only"
ON public.properties
FOR ALL
TO authenticated
USING (
  -- Only admins and JG Management can modify properties
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
  )
)
WITH CHECK (
  -- Only admins and JG Management can modify properties
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
  )
);

-- ========================================
-- UNIT_SIZES TABLE - Clean RLS Policies
-- ========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Unit sizes full access for admin/management" ON public.unit_sizes;
DROP POLICY IF EXISTS "Unit sizes read for subcontractors" ON public.unit_sizes;
-- Also drop the policies we're about to create
DROP POLICY IF EXISTS "unit_sizes_select_authenticated" ON public.unit_sizes;
DROP POLICY IF EXISTS "unit_sizes_modify_admin_only" ON public.unit_sizes;

-- Ensure RLS is enabled
ALTER TABLE public.unit_sizes ENABLE ROW LEVEL SECURITY;

-- Create clean policies for unit_sizes table
CREATE POLICY "unit_sizes_select_authenticated"
ON public.unit_sizes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "unit_sizes_modify_admin_only"
ON public.unit_sizes
FOR ALL
TO authenticated
USING (
  -- Only admins and JG Management can modify unit sizes
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
  )
)
WITH CHECK (
  -- Only admins and JG Management can modify unit sizes
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
  )
);

-- ========================================
-- JOB_TYPES TABLE - Clean RLS Policies
-- ========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Job types full access for admin/management" ON public.job_types;
DROP POLICY IF EXISTS "Job types read for subcontractors" ON public.job_types;
-- Also drop the policies we're about to create
DROP POLICY IF EXISTS "job_types_select_authenticated" ON public.job_types;
DROP POLICY IF EXISTS "job_types_modify_admin_only" ON public.job_types;

-- Ensure RLS is enabled
ALTER TABLE public.job_types ENABLE ROW LEVEL SECURITY;

-- Create clean policies for job_types table
CREATE POLICY "job_types_select_authenticated"
ON public.job_types
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "job_types_modify_admin_only"
ON public.job_types
FOR ALL
TO authenticated
USING (
  -- Only admins and JG Management can modify job types
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
  )
)
WITH CHECK (
  -- Only admins and JG Management can modify job types
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
  )
);

-- ========================================
-- JOB_CATEGORIES TABLE - Clean RLS Policies
-- ========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to create job categories" ON public.job_categories;
DROP POLICY IF EXISTS "Allow authenticated users to view all job categories" ON public.job_categories;
DROP POLICY IF EXISTS "Allow authenticated users to update job categories" ON public.job_categories;
DROP POLICY IF EXISTS "Allow authenticated users to delete job categories" ON public.job_categories;
DROP POLICY IF EXISTS "Authenticated users can view job_categories" ON public.job_categories;
DROP POLICY IF EXISTS "Authenticated users can insert job_categories" ON public.job_categories;
DROP POLICY IF EXISTS "Authenticated users can update job_categories" ON public.job_categories;
DROP POLICY IF EXISTS "Authenticated users can delete job_categories" ON public.job_categories;
-- Also drop the policies we're about to create
DROP POLICY IF EXISTS "job_categories_select_authenticated" ON public.job_categories;
DROP POLICY IF EXISTS "job_categories_modify_admin_only" ON public.job_categories;

-- Ensure RLS is enabled
ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;

-- Create clean policies for job_categories table
CREATE POLICY "job_categories_select_authenticated"
ON public.job_categories
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "job_categories_modify_admin_only"
ON public.job_categories
FOR ALL
TO authenticated
USING (
  -- Only admins and JG Management can modify job categories
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
  )
)
WITH CHECK (
  -- Only admins and JG Management can modify job categories
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'jg_management')
  )
);

-- ========================================
-- VERIFICATION QUERY
-- ========================================

-- This query will show all current policies for verification
-- Uncomment and run to verify the cleanup worked:
/*
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('jobs', 'job_phases', 'job_phase_changes', 'properties', 'unit_sizes', 'job_types', 'job_categories')
ORDER BY tablename, policyname;
*/
