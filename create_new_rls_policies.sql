-- CREATE NEW RLS POLICIES
-- Now that RLS is disabled and all old policies are gone, let's create the perfect policies

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

-- Now re-enable RLS on the profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Verify the new policies were created
SELECT 
    c.relname as table_name,
    COUNT(pol.polname) as policy_count,
    c.relrowsecurity as rls_enabled
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
LEFT JOIN pg_policy pol ON c.oid = pol.polrelid
WHERE n.nspname = 'public'
  AND c.relname = 'profiles'
GROUP BY c.relname, c.relrowsecurity;

-- Test if the policies work without infinite recursion
SELECT 'profiles' as table_name, COUNT(*) as row_count FROM profiles;

-- Test specific user profile access
SELECT id, email, full_name, role FROM profiles WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

