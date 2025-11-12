-- AGGRESSIVE POLICY CLEANUP
-- This will identify and remove ALL remaining policies on the profiles table

-- First, let's see EXACTLY what policies remain
SELECT 
    pol.polname as policy_name,
    pol.polcmd as command,
    pol.polpermissive as permissive,
    pol.polroles as roles,
    pol.polqual as select_condition,
    pol.polwithcheck as insert_check
FROM pg_policy pol
JOIN pg_class c ON pol.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname = 'profiles'
ORDER BY pol.polname;

-- Now let's drop policies by their exact names
-- We'll use a more comprehensive approach
DO $$
DECLARE
    policy_rec RECORD;
BEGIN
    FOR policy_rec IN 
        SELECT polname 
        FROM pg_policy pol
        JOIN pg_class c ON pol.polrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public' AND c.relname = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', policy_rec.polname);
        RAISE NOTICE 'Dropped policy: %', policy_rec.polname;
    END LOOP;
END $$;

-- Verify all policies are now gone
SELECT 
    c.relname as table_name,
    COUNT(pol.polname) as remaining_policies
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
LEFT JOIN pg_policy pol ON c.oid = pol.polrelid
WHERE n.nspname = 'public'
  AND c.relname = 'profiles'
GROUP BY c.relname;

-- If there are still policies, let's try a different approach
-- Check if there are any system policies or constraints
SELECT 
    c.relname as table_name,
    c.relrowsecurity as rls_enabled
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname = 'profiles';

-- The profiles table should now have 0 policies and be ready for new ones

