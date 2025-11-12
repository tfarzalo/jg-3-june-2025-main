-- CLEANUP RLS POLICIES
-- This script removes duplicate and conflicting policies that are causing infinite recursion

-- First, let's see the current policy count per table
SELECT 
    c.relname as table_name,
    COUNT(pol.polname) as policy_count
FROM pg_policy pol
JOIN pg_class c ON pol.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('profiles', 'jobs', 'job_phases', 'properties')
GROUP BY c.relname
ORDER BY c.relname;

-- Clean up profiles table policies (keep only essential ones)
-- Remove duplicate policies and keep the most permissive ones
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view and update their own profile" ON profiles;
DROP POLICY IF EXISTS "enable_read_access_for_users" ON profiles;
DROP POLICY IF EXISTS "enable_update_for_users" ON profiles;
DROP POLICY IF EXISTS "enable_admin_read_access" ON profiles;
DROP POLICY IF EXISTS "enable_admin_update_access" ON profiles;
DROP POLICY IF EXISTS "profiles: self-update last_seen" ON profiles;

-- Keep only the essential policies
-- Create simplified, non-conflicting policies
CREATE POLICY "profiles_read_own" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own" ON profiles
    FOR DELETE USING (auth.uid() = id);

-- Clean up jobs table policies
DROP POLICY IF EXISTS "allow_users_to_view_their_jobs" ON jobs;
DROP POLICY IF EXISTS "allow_users_to_update_their_jobs" ON jobs;
DROP POLICY IF EXISTS "allow_authenticated_users_to_create_jobs" ON jobs;
DROP POLICY IF EXISTS "allow_admins_to_delete_jobs" ON jobs;

-- Create simplified jobs policies
CREATE POLICY "jobs_read_all" ON jobs
    FOR SELECT USING (true);

CREATE POLICY "jobs_insert_auth" ON jobs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "jobs_update_own" ON jobs
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "jobs_delete_admin" ON jobs
    FOR DELETE USING (auth.role() = 'authenticated');

-- Clean up job_phases table policies
DROP POLICY IF EXISTS "Authenticated SELECT on job_phases" ON job_phases;
DROP POLICY IF EXISTS "Authenticated INSERT on job_phases" ON job_phases;
DROP POLICY IF EXISTS "Authenticated UPDATE on job_phases" ON job_phases;
DROP POLICY IF EXISTS "Authenticated DELETE on job_phases" ON job_phases;
DROP POLICY IF EXISTS "Allow authenticated users to view all job phases" ON job_phases;
DROP POLICY IF EXISTS "Allow authenticated users to create job phases" ON job_phases;
DROP POLICY IF EXISTS "Allow admins to update job phases" ON job_phases;
DROP POLICY IF EXISTS "Allow admins to delete job phases" ON job_phases;
DROP POLICY IF EXISTS "Authenticated read access on job_phases" ON job_phases;
DROP POLICY IF EXISTS "Authenticated users can view job phases" ON job_phases;

-- Create simplified job_phases policies
CREATE POLICY "job_phases_read_all" ON job_phases
    FOR SELECT USING (true);

CREATE POLICY "job_phases_insert_auth" ON job_phases
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "job_phases_update_auth" ON job_phases
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "job_phases_delete_auth" ON job_phases
    FOR DELETE USING (auth.role() = 'authenticated');

-- Clean up properties table policies
DROP POLICY IF EXISTS "Authenticated SELECT on properties" ON properties;
DROP POLICY IF EXISTS "Authenticated INSERT on properties" ON properties;
DROP POLICY IF EXISTS "Authenticated UPDATE on properties" ON properties;
DROP POLICY IF EXISTS "Authenticated DELETE on properties" ON properties;
DROP POLICY IF EXISTS "Authenticated users can view properties" ON properties;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON properties;
DROP POLICY IF EXISTS "Enable read access for all users" ON properties;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON properties;
DROP POLICY IF EXISTS "Public read access for approval pages" ON properties;

-- Create simplified properties policies
CREATE POLICY "properties_read_all" ON properties
    FOR SELECT USING (true);

CREATE POLICY "properties_insert_auth" ON properties
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "properties_update_auth" ON properties
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "properties_delete_auth" ON properties
    FOR DELETE USING (auth.role() = 'authenticated');

-- Verify the cleanup
SELECT 
    c.relname as table_name,
    COUNT(pol.polname) as policy_count
FROM pg_policy pol
JOIN pg_class c ON pol.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('profiles', 'jobs', 'job_phases', 'properties')
GROUP BY c.relname
ORDER BY c.relname;

-- Test if tables are now accessible
SELECT 'profiles' as table_name, COUNT(*) as row_count FROM profiles
UNION ALL
SELECT 'jobs' as table_name, COUNT(*) as row_count FROM jobs
UNION ALL
SELECT 'job_phases' as table_name, COUNT(*) as row_count FROM job_phases
UNION ALL
SELECT 'properties' as table_name, COUNT(*) as row_count FROM properties;
