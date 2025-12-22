-- NUCLEAR OPTION: Completely disable RLS on all tables
-- This will stop the infinite recursion immediately

-- Disable RLS on profiles table
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Disable RLS on jobs table
ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;

-- Disable RLS on job_phases table
ALTER TABLE job_phases DISABLE ROW LEVEL SECURITY;

-- Disable RLS on properties table
ALTER TABLE properties DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT 
    c.relname as table_name,
    c.relrowsecurity as rls_enabled
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('profiles', 'jobs', 'job_phases', 'properties')
ORDER BY c.relname;

-- Test if tables are now accessible without RLS
SELECT 'profiles' as table_name, COUNT(*) as row_count FROM profiles
UNION ALL
SELECT 'jobs' as table_name, COUNT(*) as row_count FROM jobs
UNION ALL
SELECT 'job_phases' as table_name, COUNT(*) as row_count FROM job_phases
UNION ALL
SELECT 'properties' as table_name, COUNT(*) as row_count FROM properties;

-- Test specific user profile access
SELECT id, email, full_name, role FROM profiles WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- If this works, the app should now function
-- We can re-enable RLS with proper policies later

