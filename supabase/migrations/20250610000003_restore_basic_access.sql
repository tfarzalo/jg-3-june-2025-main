/*
  # Restore Basic Access - Essential Tables Only

  1. Purpose
    - Restore basic access to essential tables after RLS cleanup
    - Allow job category dropdown to populate
    - Enable basic form functionality while maintaining security

  2. What This Does
    - Creates minimal RLS policies for essential tables
    - Allows authenticated users to read necessary data
    - Maintains security for sensitive operations
*/

-- ========================================
-- JOB_CATEGORIES TABLE - Basic Read Access
-- ========================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "job_categories_read_all" ON public.job_categories;

-- Ensure RLS is enabled
ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;

-- Create basic read policy for all authenticated users
CREATE POLICY "job_categories_read_all"
ON public.job_categories
FOR SELECT
TO authenticated
USING (true);

-- ========================================
-- BILLING_CATEGORIES TABLE - Basic Read Access
-- ========================================

-- Check if billing_categories table exists before creating policies
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_categories') THEN
    -- Enable RLS
    EXECUTE 'ALTER TABLE public.billing_categories ENABLE ROW LEVEL SECURITY';
    
    -- Drop existing policy if it exists
    EXECUTE 'DROP POLICY IF EXISTS "billing_categories_read_all" ON public.billing_categories';
    
    -- Create basic read policy for all authenticated users
    EXECUTE 'CREATE POLICY "billing_categories_read_all" ON public.billing_categories FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;

-- ========================================
-- PROPERTIES TABLE - Basic Read Access
-- ========================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "properties_read_all" ON public.properties;

-- Ensure RLS is enabled
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Create basic read policy for all authenticated users
CREATE POLICY "properties_read_all"
ON public.properties
FOR SELECT
TO authenticated
USING (true);

-- ========================================
-- UNIT_SIZES TABLE - Basic Read Access
-- ========================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "unit_sizes_read_all" ON public.unit_sizes;

-- Ensure RLS is enabled
ALTER TABLE public.unit_sizes ENABLE ROW LEVEL SECURITY;

-- Create basic read policy for all authenticated users
CREATE POLICY "unit_sizes_read_all"
ON public.unit_sizes
FOR SELECT
TO authenticated
USING (true);

-- ========================================
-- JOB_TYPES TABLE - Basic Read Access
-- ========================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "job_types_read_all" ON public.job_types;

-- Ensure RLS is enabled
ALTER TABLE public.job_types ENABLE ROW LEVEL SECURITY;

-- Create basic read policy for all authenticated users
CREATE POLICY "job_types_read_all"
ON public.job_types
FOR SELECT
TO authenticated
USING (true);

-- ========================================
-- JOB_PHASES TABLE - Basic Read Access
-- ========================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "job_phases_read_all" ON public.job_phases;

-- Ensure RLS is enabled
ALTER TABLE public.job_phases ENABLE ROW LEVEL SECURITY;

-- Create basic read policy for all authenticated users
CREATE POLICY "job_phases_read_all"
ON public.job_phases
FOR SELECT
TO authenticated
USING (true);

-- ========================================
-- VERIFICATION
-- ========================================

-- Show the basic policies we just created
SELECT 
  'BASIC ACCESS RESTORED' as status,
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE schemaname = 'public'
AND policyname LIKE '%read_all%'
ORDER BY tablename, policyname;
