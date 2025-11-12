-- Fix RLS Policies for Properties and Related Tables
-- This script ensures that authenticated users can access property data, paint colors, and billing info

-- ========================================
-- STEP 1: Check current RLS status
-- ========================================
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('properties', 'billing_categories', 'billing_details', 'unit_sizes');

-- ========================================
-- STEP 2: Fix Properties Table RLS
-- ========================================

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "properties_select_all" ON properties;
DROP POLICY IF EXISTS "properties_select_authenticated" ON properties;
DROP POLICY IF EXISTS "properties_read_all" ON properties;
DROP POLICY IF EXISTS "properties_insert_admin" ON properties;
DROP POLICY IF EXISTS "properties_update_admin" ON properties;
DROP POLICY IF EXISTS "properties_delete_admin" ON properties;
DROP POLICY IF EXISTS "properties_modify_admin_only" ON properties;
DROP POLICY IF EXISTS "properties_read_auth" ON properties;
DROP POLICY IF EXISTS "properties_insert_auth" ON properties;
DROP POLICY IF EXISTS "properties_update_auth" ON properties;
DROP POLICY IF EXISTS "properties_delete_auth" ON properties;
DROP POLICY IF EXISTS "Public read access for approval pages" ON properties;
DROP POLICY IF EXISTS "Anyone can view properties" ON properties;
DROP POLICY IF EXISTS "Authenticated users can insert properties" ON properties;
DROP POLICY IF EXISTS "Authenticated users can update properties" ON properties;

-- Ensure RLS is enabled
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Create simple, non-conflicting policies
CREATE POLICY "properties_read_all"
ON properties
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "properties_modify_admin_management"
ON properties
FOR ALL
TO authenticated
USING (
  -- Check if user has admin or management role
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'jg_management')
  )
)
WITH CHECK (
  -- Check if user has admin or management role
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'jg_management')
  )
);

-- ========================================
-- STEP 3: Fix Billing Categories Table RLS
-- ========================================

-- Check if billing_categories table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_categories') THEN
    -- Drop existing policies
    EXECUTE 'DROP POLICY IF EXISTS "billing_categories_read_all" ON public.billing_categories';
    EXECUTE 'DROP POLICY IF EXISTS "billing_categories_select_auth" ON public.billing_categories';
    
    -- Enable RLS
    EXECUTE 'ALTER TABLE public.billing_categories ENABLE ROW LEVEL SECURITY';
    
    -- Create read policy for all authenticated users
    EXECUTE 'CREATE POLICY "billing_categories_read_all" ON public.billing_categories FOR SELECT TO authenticated USING (true)';
    
    -- Create modify policy for admin/management only
    EXECUTE 'CREATE POLICY "billing_categories_modify_admin_management" ON public.billing_categories FOR ALL TO authenticated USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN (''admin'', ''jg_management'')
      )
    )';
  END IF;
END $$;

-- ========================================
-- STEP 4: Fix Billing Details Table RLS
-- ========================================

-- Check if billing_details table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_details') THEN
    -- Drop existing policies
    EXECUTE 'DROP POLICY IF EXISTS "billing_details_read_all" ON public.billing_details';
    
    -- Enable RLS
    EXECUTE 'ALTER TABLE public.billing_details ENABLE ROW LEVEL SECURITY';
    
    -- Create read policy for all authenticated users
    EXECUTE 'CREATE POLICY "billing_details_read_all" ON public.billing_details FOR SELECT TO authenticated USING (true)';
    
    -- Create modify policy for admin/management only
    EXECUTE 'CREATE POLICY "billing_details_modify_admin_management" ON public.billing_details FOR ALL TO authenticated USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN (''admin'', ''jg_management'')
      )
    )';
  END IF;
END $$;

-- ========================================
-- STEP 5: Fix Unit Sizes Table RLS
-- ========================================

-- Check if unit_sizes table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'unit_sizes') THEN
    -- Drop existing policies
    EXECUTE 'DROP POLICY IF EXISTS "unit_sizes_read_all" ON public.unit_sizes';
    
    -- Enable RLS
    EXECUTE 'ALTER TABLE public.unit_sizes ENABLE ROW LEVEL SECURITY';
    
    -- Create read policy for all authenticated users
    EXECUTE 'CREATE POLICY "unit_sizes_read_all" ON public.unit_sizes FOR SELECT TO authenticated USING (true)';
    
    -- Create modify policy for admin/management only
    EXECUTE 'CREATE POLICY "unit_sizes_modify_admin_management" ON public.unit_sizes FOR ALL TO authenticated USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN (''admin'', ''jg_management'')
      )
    )';
  END IF;
END $$;

-- ========================================
-- STEP 6: Fix Paint Colors Tables RLS (if they exist)
-- ========================================

-- Check if property_paint_schemes table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'property_paint_schemes') THEN
    -- Drop existing policies
    EXECUTE 'DROP POLICY IF EXISTS "property_paint_schemes_read_all" ON public.property_paint_schemes';
    
    -- Enable RLS
    EXECUTE 'ALTER TABLE public.property_paint_schemes ENABLE ROW LEVEL SECURITY';
    
    -- Create read policy for all authenticated users
    EXECUTE 'CREATE POLICY "property_paint_schemes_read_all" ON public.property_paint_schemes FOR SELECT TO authenticated USING (true)';
    
    -- Create modify policy for admin/management only
    EXECUTE 'CREATE POLICY "property_paint_schemes_modify_admin_management" ON public.property_paint_schemes FOR ALL TO authenticated USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN (''admin'', ''jg_management'')
      )
    )';
  END IF;
END $$;

-- Check if property_paint_rows table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'property_paint_rows') THEN
    -- Drop existing policies
    EXECUTE 'DROP POLICY IF EXISTS "property_paint_rows_read_all" ON public.property_paint_rows';
    
    -- Enable RLS
    EXECUTE 'ALTER TABLE public.property_paint_rows ENABLE ROW LEVEL SECURITY';
    
    -- Create read policy for all authenticated users
    EXECUTE 'CREATE POLICY "property_paint_rows_read_all" ON public.property_paint_rows FOR SELECT TO authenticated USING (true)';
    
    -- Create modify policy for admin/management only
    EXECUTE 'CREATE POLICY "property_paint_rows_modify_admin_management" ON public.property_paint_rows FOR ALL TO authenticated USING (
      EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role IN (''admin'', ''jg_management'')
      )
    )';
  END IF;
END $$;

-- ========================================
-- STEP 7: Verify the fixes
-- ========================================

-- Check current RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('properties', 'billing_categories', 'billing_details', 'unit_sizes', 'property_paint_schemes', 'property_paint_rows');

-- Check policies for properties table
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
AND tablename = 'properties';

-- Test if properties table is now accessible
SELECT COUNT(*) as property_count FROM properties LIMIT 1;

-- Test if billing categories are accessible
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_categories') THEN
    EXECUTE 'SELECT COUNT(*) as billing_category_count FROM public.billing_categories LIMIT 1';
  END IF;
END $$;

-- Test if unit sizes are accessible
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'unit_sizes') THEN
    EXECUTE 'SELECT COUNT(*) as unit_size_count FROM public.unit_sizes LIMIT 1';
  END IF;
END $$;
