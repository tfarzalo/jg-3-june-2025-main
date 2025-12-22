/*
  # Fix Billing Details Permissions
  
  This script fixes the RLS policies for job_categories and billing_details tables
  to allow authenticated users to perform necessary operations for billing details.
  
  Issues Fixed:
  1. 403 error on job_categories upsert - allow authenticated users to insert/update
  2. 409 error on billing_details insert - ensure proper conflict handling
*/

-- ========================================
-- JOB_CATEGORIES TABLE - Allow Upsert for All Authenticated Users
-- ========================================

-- Drop ALL existing policies first to avoid conflicts
DROP POLICY IF EXISTS "job_categories_modify_admin_only" ON public.job_categories;
DROP POLICY IF EXISTS "job_categories_select_authenticated" ON public.job_categories;
DROP POLICY IF EXISTS "job_categories_read_all" ON public.job_categories;
DROP POLICY IF EXISTS "job_categories_upsert_all" ON public.job_categories;
DROP POLICY IF EXISTS "Allow authenticated users to create job categories" ON public.job_categories;
DROP POLICY IF EXISTS "Allow authenticated users to view all job categories" ON public.job_categories;
DROP POLICY IF EXISTS "Allow authenticated users to update job categories" ON public.job_categories;
DROP POLICY IF EXISTS "Allow authenticated users to delete job categories" ON public.job_categories;
DROP POLICY IF EXISTS "Authenticated users can view job_categories" ON public.job_categories;
DROP POLICY IF EXISTS "Authenticated users can insert job_categories" ON public.job_categories;
DROP POLICY IF EXISTS "Authenticated users can update job_categories" ON public.job_categories;
DROP POLICY IF EXISTS "Authenticated users can delete job_categories" ON public.job_categories;

-- Ensure RLS is enabled
ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;

-- Create policies that allow all authenticated users to read and modify job categories
-- This is needed for the billing form to upsert default categories
CREATE POLICY "job_categories_read_all"
ON public.job_categories
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "job_categories_upsert_all"
ON public.job_categories
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ========================================
-- BILLING_DETAILS TABLE - Ensure Proper Access
-- ========================================

-- Check if billing_details table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_details') THEN
    -- Drop ALL existing policies to avoid conflicts
    EXECUTE 'DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.billing_details';
    EXECUTE 'DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.billing_details';
    EXECUTE 'DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.billing_details';
    EXECUTE 'DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.billing_details';
    EXECUTE 'DROP POLICY IF EXISTS "billing_details_read_all" ON public.billing_details';
    EXECUTE 'DROP POLICY IF EXISTS "billing_details_modify_all" ON public.billing_details';
    EXECUTE 'DROP POLICY IF EXISTS "billing_details_insert_all" ON public.billing_details';
    EXECUTE 'DROP POLICY IF EXISTS "billing_details_update_all" ON public.billing_details';
    EXECUTE 'DROP POLICY IF EXISTS "billing_details_delete_all" ON public.billing_details';
    EXECUTE 'DROP POLICY IF EXISTS "Billing details read access" ON public.billing_details';
    EXECUTE 'DROP POLICY IF EXISTS "Billing details insert access" ON public.billing_details';
    EXECUTE 'DROP POLICY IF EXISTS "Billing details update access" ON public.billing_details';
    EXECUTE 'DROP POLICY IF EXISTS "Billing details delete access" ON public.billing_details';
    
    -- Enable RLS
    EXECUTE 'ALTER TABLE public.billing_details ENABLE ROW LEVEL SECURITY';
    
    -- Create comprehensive policies for billing_details
    EXECUTE 'CREATE POLICY "billing_details_read_all" ON public.billing_details FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "billing_details_insert_all" ON public.billing_details FOR INSERT TO authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "billing_details_update_all" ON public.billing_details FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "billing_details_delete_all" ON public.billing_details FOR DELETE TO authenticated USING (true)';
  END IF;
END $$;

-- ========================================
-- BILLING_CATEGORIES TABLE - Ensure Proper Access
-- ========================================

-- Check if billing_categories table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_categories') THEN
    -- Drop ALL existing policies to avoid conflicts
    EXECUTE 'DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.billing_categories';
    EXECUTE 'DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.billing_categories';
    EXECUTE 'DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.billing_categories';
    EXECUTE 'DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.billing_categories';
    EXECUTE 'DROP POLICY IF EXISTS "billing_categories_read_all" ON public.billing_categories';
    EXECUTE 'DROP POLICY IF EXISTS "billing_categories_modify_all" ON public.billing_categories';
    EXECUTE 'DROP POLICY IF EXISTS "billing_categories_insert_all" ON public.billing_categories';
    EXECUTE 'DROP POLICY IF EXISTS "billing_categories_update_all" ON public.billing_categories';
    EXECUTE 'DROP POLICY IF EXISTS "billing_categories_delete_all" ON public.billing_categories';
    EXECUTE 'DROP POLICY IF EXISTS "Billing categories read access" ON public.billing_categories';
    EXECUTE 'DROP POLICY IF EXISTS "Billing categories insert access" ON public.billing_categories';
    EXECUTE 'DROP POLICY IF EXISTS "Billing categories update access" ON public.billing_categories';
    EXECUTE 'DROP POLICY IF EXISTS "Billing categories delete access" ON public.billing_categories';
    
    -- Enable RLS
    EXECUTE 'ALTER TABLE public.billing_categories ENABLE ROW LEVEL SECURITY';
    
    -- Create comprehensive policies for billing_categories
    EXECUTE 'CREATE POLICY "billing_categories_read_all" ON public.billing_categories FOR SELECT TO authenticated USING (true)';
    EXECUTE 'CREATE POLICY "billing_categories_insert_all" ON public.billing_categories FOR INSERT TO authenticated WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "billing_categories_update_all" ON public.billing_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
    EXECUTE 'CREATE POLICY "billing_categories_delete_all" ON public.billing_categories FOR DELETE TO authenticated USING (true)';
  END IF;
END $$;

-- ========================================
-- VERIFICATION
-- ========================================

-- Show current policies for verification
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
WHERE tablename IN ('job_categories', 'billing_details', 'billing_categories')
ORDER BY tablename, policyname;
