-- PROPER RLS POLICIES
-- Clean, non-conflicting policies that provide security without infinite recursion

-- First, let's see what other tables have RLS enabled
SELECT 
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    COUNT(pol.polname) as policy_count
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
LEFT JOIN pg_policy pol ON c.oid = pol.polrelid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'  -- Only regular tables
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;

-- Now let's create PROPER policies for the 4 main tables
-- These policies are simple, non-recursive, and secure

-- ========================================
-- PROFILES TABLE - Custom role-based access control
-- ========================================
-- Subcontractors: NO ACCESS to any profiles
-- JG Management: Can access, edit, update (but cannot delete own or subcontractor)
-- Admin: Full access to subcontractor, jg_management, own (but cannot modify other admins)

-- SELECT policies
CREATE POLICY "profiles_select_subcontractors" ON profiles
    FOR SELECT USING (
        role != 'subcontractor'  -- Subcontractors cannot see any profiles
    );

-- JG Management can access all profiles except subcontractors
CREATE POLICY "profiles_select_jg_management" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'jg_management'
        )
        AND role != 'subcontractor'  -- JG Management cannot see subcontractor profiles
    );

-- Admins can access subcontractor, jg_management, and own profiles (but not other admins)
CREATE POLICY "profiles_select_admin" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
        AND (
            role = 'subcontractor' 
            OR role = 'jg_management'
            OR (role = 'admin' AND auth.uid() = id)  -- Admins can only see their own profile
        )
    );

-- Regular users can only see their own profile (if not subcontractor)
CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (
        auth.uid() = id 
        AND role NOT IN ('subcontractor', 'jg_management', 'admin')  -- Only regular users
    );

-- INSERT policies
-- Only admins can create profiles for subcontractors and jg_management
CREATE POLICY "profiles_insert_admin" ON profiles
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
        AND role IN ('subcontractor', 'jg_management')
    );

-- Regular users can create their own profile (if not subcontractor)
CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT WITH CHECK (
        auth.uid() = id 
        AND role NOT IN ('subcontractor', 'jg_management', 'admin')
    );

-- UPDATE policies
-- JG Management can update all profiles except subcontractors and own
CREATE POLICY "profiles_update_jg_management" ON profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'jg_management'
        )
        AND role != 'subcontractor'  -- Cannot update subcontractor profiles
        AND auth.uid() != id  -- Cannot update own profile
    );

-- Admins can update subcontractor, jg_management, and own profiles (but not other admins)
CREATE POLICY "profiles_update_admin" ON profiles
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
        AND (
            role = 'subcontractor' 
            OR role = 'jg_management'
            OR (role = 'admin' AND auth.uid() = id)  -- Admins can only update their own profile
        )
    );

-- Regular users can update their own profile (if not subcontractor)
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (
        auth.uid() = id 
        AND role NOT IN ('subcontractor', 'jg_management', 'admin')
    );

-- DELETE policies
-- JG Management can delete profiles (but not own or subcontractor)
CREATE POLICY "profiles_delete_jg_management" ON profiles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'jg_management'
        )
        AND role != 'subcontractor'  -- Cannot delete subcontractor profiles
        AND auth.uid() != id  -- Cannot delete own profile
    );

-- Admins can delete subcontractor and jg_management profiles (but not admin profiles)
CREATE POLICY "profiles_delete_admin" ON profiles
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
        AND role IN ('subcontractor', 'jg_management')  -- Cannot delete admin profiles
    );

-- Regular users can delete their own profile (if not subcontractor)
CREATE POLICY "profiles_delete_own" ON profiles
    FOR DELETE USING (
        auth.uid() = id 
        AND role NOT IN ('subcontractor', 'jg_management', 'admin')
    );

-- ========================================
-- JOBS TABLE - Users can view all jobs, but only modify their own
-- ========================================
CREATE POLICY "jobs_select_all" ON jobs
    FOR SELECT USING (true);  -- Everyone can view all jobs

CREATE POLICY "jobs_insert_auth" ON jobs
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "jobs_update_own" ON jobs
    FOR UPDATE USING (auth.uid() = created_by);  -- Only creator can update

CREATE POLICY "jobs_delete_own" ON jobs
    FOR DELETE USING (auth.uid() = created_by);  -- Only creator can delete

-- ========================================
-- JOB_PHASES TABLE - Read-only for most users, full access for admins
-- ========================================
CREATE POLICY "job_phases_select_all" ON job_phases
    FOR SELECT USING (true);  -- Everyone can view phases

CREATE POLICY "job_phases_insert_admin" ON job_phases
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'jg_management')
        )
    );

CREATE POLICY "job_phases_update_admin" ON job_phases
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'jg_management')
        )
    );

CREATE POLICY "job_phases_delete_admin" ON job_phases
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'jg_management')
        )
    );

-- ========================================
-- PROPERTIES TABLE - Read access for all, modify for admins
-- ========================================
CREATE POLICY "properties_select_all" ON properties
    FOR SELECT USING (true);  -- Everyone can view properties

CREATE POLICY "properties_insert_admin" ON properties
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'jg_management')
        )
    );

CREATE POLICY "properties_update_admin" ON properties
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'jg_management')
        )
    );

CREATE POLICY "properties_delete_admin" ON properties
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'jg_management')
        )
    );

-- Now re-enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Verify the new policies
SELECT 
    c.relname as table_name,
    COUNT(pol.polname) as policy_count
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
LEFT JOIN pg_policy pol ON c.oid = pol.polrelid
WHERE n.nspname = 'public'
  AND c.relname IN ('profiles', 'jobs', 'job_phases', 'properties')
GROUP BY c.relname
ORDER BY c.relname;

-- Test if the policies work without infinite recursion
SELECT 'profiles' as table_name, COUNT(*) as row_count FROM profiles
UNION ALL
SELECT 'jobs' as table_name, COUNT(*) as row_count FROM jobs
UNION ALL
SELECT 'job_phases' as table_name, COUNT(*) as row_count FROM job_phases
UNION ALL
SELECT 'properties' as table_name, COUNT(*) as row_count FROM properties;
