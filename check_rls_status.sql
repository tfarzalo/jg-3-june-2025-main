-- Check RLS Status and Policies
-- This script helps diagnose RLS issues that might be preventing data access

-- ========================================
-- STEP 1: Check which tables have RLS enabled
-- ========================================
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
    'properties', 
    'billing_categories', 
    'billing_details', 
    'unit_sizes', 
    'property_paint_schemes', 
    'property_paint_rows',
    'profiles',
    'jobs',
    'job_phases'
)
ORDER BY tablename;

-- ========================================
-- STEP 2: Check existing policies for key tables
-- ========================================
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
AND tablename IN (
    'properties', 
    'billing_categories', 
    'billing_details', 
    'unit_sizes'
)
ORDER BY tablename, policyname;

-- ========================================
-- STEP 3: Check if tables are accessible to current user
-- ========================================
-- Test properties table access
SELECT 'properties' as table_name, 
       CASE 
           WHEN COUNT(*) > 0 THEN 'ACCESSIBLE' 
           ELSE 'NOT ACCESSIBLE' 
       END as status,
       COUNT(*) as row_count
FROM properties;

-- Test billing_categories table access (if it exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_categories') THEN
    RAISE NOTICE 'billing_categories table exists - testing access...';
    EXECUTE 'SELECT ''billing_categories'' as table_name, 
                   CASE 
                       WHEN COUNT(*) > 0 THEN ''ACCESSIBLE'' 
                       ELSE ''NOT ACCESSIBLE'' 
                   END as status,
                   COUNT(*) as row_count
            FROM public.billing_categories';
  ELSE
    RAISE NOTICE 'billing_categories table does not exist';
  END IF;
END $$;

-- Test unit_sizes table access (if it exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'unit_sizes') THEN
    RAISE NOTICE 'unit_sizes table exists - testing access...';
    EXECUTE 'SELECT ''unit_sizes'' as table_name, 
                   CASE 
                       WHEN COUNT(*) > 0 THEN ''ACCESSIBLE'' 
                       ELSE ''NOT ACCESSIBLE'' 
                   END as status,
                   COUNT(*) as row_count
            FROM public.unit_sizes';
  ELSE
    RAISE NOTICE 'unit_sizes table does not exist';
  END IF;
END $$;

-- ========================================
-- STEP 4: Check current user authentication status
-- ========================================
SELECT 
    'Current User' as info,
    auth.uid() as user_id,
    auth.role() as user_role,
    CASE 
        WHEN auth.uid() IS NOT NULL THEN 'AUTHENTICATED'
        ELSE 'NOT AUTHENTICATED'
    END as auth_status;

-- ========================================
-- STEP 5: Check if there are any conflicting policies
-- ========================================
-- Look for policies that might be causing infinite recursion
SELECT 
    'Potential Recursion Issue' as issue,
    tablename,
    policyname,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public' 
AND (
    qual LIKE '%profiles%' 
    OR qual LIKE '%auth.uid()%'
    OR with_check LIKE '%profiles%'
    OR with_check LIKE '%auth.uid()%'
)
ORDER BY tablename, policyname;

-- ========================================
-- STEP 6: Check for missing policies
-- ========================================
SELECT 
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    COUNT(pol.polname) as policy_count,
    CASE 
        WHEN c.relrowsecurity = true AND COUNT(pol.polname) = 0 THEN 'MISSING POLICIES'
        WHEN c.relrowsecurity = false THEN 'RLS DISABLED'
        ELSE 'HAS POLICIES'
    END as status
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
LEFT JOIN pg_policy pol ON c.oid = pol.polrelid
WHERE n.nspname = 'public'
  AND c.relname IN (
      'properties', 
      'billing_categories', 
      'billing_details', 
      'unit_sizes'
  )
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relname;
