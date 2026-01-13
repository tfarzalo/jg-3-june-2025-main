/*
  # Rollback and Clean RLS Policies - Complete Reset

  1. Purpose
    - Show current state of all tables and policies before changes
    - Drop ALL RLS policies to provide clean slate
    - Allow for complete policy recreation later

  2. What This Does
    - Documents current state for reference
    - Removes all conflicting policies
    - Prepares for fresh policy implementation
*/

-- ========================================
-- DOCUMENT CURRENT STATE - TABLES
-- ========================================

-- Show all tables in the public schema
SELECT 
  'TABLE' as object_type,
  table_name,
  'public' as schema_name,
  'N/A' as policy_name,
  'N/A' as policy_details
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ========================================
-- DOCUMENT CURRENT STATE - RLS STATUS
-- ========================================

-- Show which tables have RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- ========================================
-- DOCUMENT CURRENT STATE - ALL POLICIES
-- ========================================

-- Show all current RLS policies
SELECT 
  'POLICY' as object_type,
  tablename,
  schemaname,
  policyname,
  'Command: ' || cmd || 
  CASE 
    WHEN permissive IS NOT NULL THEN ' | Permissive: ' || permissive
    ELSE ''
  END ||
  CASE 
    WHEN roles IS NOT NULL THEN ' | Roles: ' || array_to_string(roles, ', ')
    ELSE ''
  END ||
  CASE 
    WHEN qual IS NOT NULL THEN ' | Using: ' || qual
    ELSE ''
  END ||
  CASE 
    WHEN with_check IS NOT NULL THEN ' | With Check: ' || with_check
    ELSE ''
  END as policy_details
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ========================================
-- DOCUMENT CURRENT STATE - FUNCTIONS
-- ========================================

-- Show all functions in public schema
SELECT 
  'FUNCTION' as object_type,
  p.proname as function_name,
  'public' as schema_name,
  'N/A' as policy_name,
  'Parameters: ' || pg_get_function_arguments(p.oid) as policy_details
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- ========================================
-- DROP ALL RLS POLICIES - CLEAN SLATE
-- ========================================

-- Drop ALL policies from jobs table
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
DROP POLICY IF EXISTS "jobs_read_all" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_auth" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_own" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_admin" ON public.jobs;
DROP POLICY IF EXISTS "Jobs full access for admin/management" ON public.jobs;
DROP POLICY IF EXISTS "Jobs limited access for subcontractors" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_authenticated" ON public.jobs;
DROP POLICY IF EXISTS "jobs_select_role_based" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_role_based" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_admin_only" ON public.jobs;

-- Drop ALL policies from job_phases table
DROP POLICY IF EXISTS "Authenticated users can view job phases" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_read_all" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_insert_auth" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_update_auth" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_delete_auth" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_select_all" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_insert_admin" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_update_admin" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_delete_admin" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_select_authenticated" ON public.job_phases;
DROP POLICY IF EXISTS "job_phases_modify_admin_only" ON public.job_phases;

-- Drop ALL policies from job_phase_changes table
DROP POLICY IF EXISTS "Allow phase change creation" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Allow phase change viewing" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Users can insert phase changes" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Users can view phase changes for their jobs" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Allow authenticated users to create phase changes" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Enable phase changes for authenticated users" ON public.job_phase_changes;
DROP POLICY IF EXISTS "Enable viewing phase changes" ON public.job_phase_changes;
DROP POLICY IF EXISTS "job_phase_changes_insert_authenticated" ON public.job_phase_changes;
DROP POLICY IF EXISTS "job_phase_changes_select_role_based" ON public.job_phase_changes;

-- Drop ALL policies from properties table
DROP POLICY IF EXISTS "Properties full access for admin/management" ON public.properties;
DROP POLICY IF EXISTS "Properties read for subcontractors" ON public.properties;
DROP POLICY IF EXISTS "properties_select_all" ON public.properties;
DROP POLICY IF EXISTS "properties_insert_admin" ON public.properties;
DROP POLICY IF EXISTS "properties_update_admin" ON public.properties;
DROP POLICY IF EXISTS "properties_delete_admin" ON public.properties;
DROP POLICY IF EXISTS "properties_select_authenticated" ON public.properties;
DROP POLICY IF EXISTS "properties_modify_admin_only" ON public.properties;

-- Drop ALL policies from unit_sizes table
DROP POLICY IF EXISTS "Unit sizes full access for admin/management" ON public.unit_sizes;
DROP POLICY IF EXISTS "Unit sizes read for subcontractors" ON public.unit_sizes;
DROP POLICY IF EXISTS "unit_sizes_select_authenticated" ON public.unit_sizes;
DROP POLICY IF EXISTS "unit_sizes_modify_admin_only" ON public.unit_sizes;

-- Drop ALL policies from job_types table
DROP POLICY IF EXISTS "Job types full access for admin/management" ON public.job_types;
DROP POLICY IF EXISTS "Job types read for subcontractors" ON public.job_types;
DROP POLICY IF EXISTS "job_types_select_authenticated" ON public.job_types;
DROP POLICY IF EXISTS "job_types_modify_admin_only" ON public.job_types;

-- Drop ALL policies from job_categories table
DROP POLICY IF EXISTS "Allow authenticated users to create job categories" ON public.job_categories;
DROP POLICY IF EXISTS "Allow authenticated users to view all job categories" ON public.job_categories;
DROP POLICY IF EXISTS "Allow authenticated users to update job categories" ON public.job_categories;
DROP POLICY IF EXISTS "Allow authenticated users to delete job categories" ON public.job_categories;
DROP POLICY IF EXISTS "Authenticated users can view job_categories" ON public.job_categories;
DROP POLICY IF EXISTS "Authenticated users can insert job_categories" ON public.job_categories;
DROP POLICY IF EXISTS "Authenticated users can update job_categories" ON public.job_categories;
DROP POLICY IF EXISTS "Authenticated users can delete job_categories" ON public.job_categories;
DROP POLICY IF EXISTS "job_categories_select_authenticated" ON public.job_categories;
DROP POLICY IF EXISTS "job_categories_modify_admin_only" ON public.job_categories;

-- Drop ALL policies from profiles table
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_jg_management" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_jg_management" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete_jg_management" ON public.profiles;
DROP POLICY IF EXISTS "Profiles full access for admin/management" ON public.profiles;
DROP POLICY IF EXISTS "Profiles read own for subcontractors" ON public.profiles;

-- Drop ALL policies from work_orders table
DROP POLICY IF EXISTS "Work orders full access for admin/management" ON public.work_orders;
DROP POLICY IF EXISTS "Work orders limited for subcontractors" ON public.work_orders;

-- Drop ALL policies from files table
DROP POLICY IF EXISTS "Files full access for admin/management" ON public.files;
DROP POLICY IF EXISTS "Files limited for subcontractors" ON public.files;

-- Drop ALL policies from billing_categories table (if it exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_categories') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Billing categories read access" ON public.billing_categories';
    EXECUTE 'DROP POLICY IF EXISTS "Billing categories insert access" ON public.billing_categories';
    EXECUTE 'DROP POLICY IF EXISTS "Billing categories update access" ON public.billing_categories';
    EXECUTE 'DROP POLICY IF EXISTS "Billing categories delete access" ON public.billing_categories';
  END IF;
END $$;

-- Drop ALL policies from billing_details table (if it exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_details') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Billing details read access" ON public.billing_details';
    EXECUTE 'DROP POLICY IF EXISTS "Billing details insert access" ON public.billing_details';
    EXECUTE 'DROP POLICY IF EXISTS "Billing details update access" ON public.billing_details';
    EXECUTE 'DROP POLICY IF EXISTS "Billing details delete access" ON public.billing_details';
  END IF;
END $$;

-- Drop ALL policies from billing_items table (if it exists)
-- Note: This table may not exist in all databases
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_items') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Billing items read access" ON public.billing_items';
    EXECUTE 'DROP POLICY IF EXISTS "Billing items insert access" ON public.billing_items';
    EXECUTE 'DROP POLICY IF EXISTS "Billing items update access" ON public.billing_items';
    EXECUTE 'DROP POLICY IF EXISTS "Billing items delete access" ON public.billing_items';
  END IF;
END $$;

-- ========================================
-- VERIFICATION - NO POLICIES SHOULD EXIST
-- ========================================

-- This should return no rows if all policies were dropped successfully
SELECT 
  'REMAINING POLICIES' as status,
  schemaname,
  tablename,
  policyname
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ========================================
-- SUMMARY
-- ========================================

-- Show final state
SELECT 
  'CLEANUP COMPLETE' as status,
  'All RLS policies have been dropped' as message,
  'Ready for fresh policy implementation' as next_step;
