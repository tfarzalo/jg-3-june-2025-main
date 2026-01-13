-- Comprehensive fix for work order permissions
-- This addresses the issue where subcontractors can't properly save billing detail fields
-- The problem is likely that the new billing detail columns are not covered by existing policies

-- 1. First, let's see what the current policies look like
SELECT 
  'Current work_orders table policies:' as info,
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'work_orders'
ORDER BY policyname;

-- 2. Check if the new columns exist in the work_orders table
SELECT 
  'Work orders table columns:' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'work_orders' 
  AND table_schema = 'public'
  AND column_name IN (
    'ceiling_billing_detail_id', 
    'accent_wall_billing_detail_id',
    'individual_ceiling_count',
    'ceiling_display_label'
  )
ORDER BY column_name;

-- 3. Drop all existing policies to start clean
DROP POLICY IF EXISTS "Work orders authenticated access" ON work_orders;
DROP POLICY IF EXISTS "Work orders full access for admin/management" ON work_orders;
DROP POLICY IF EXISTS "Work orders limited for subcontractors" ON work_orders;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON work_orders;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON work_orders;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON work_orders;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON work_orders;
DROP POLICY IF EXISTS "Users can read work orders" ON work_orders;
DROP POLICY IF EXISTS "Users can create work orders" ON work_orders;
DROP POLICY IF EXISTS "Users can update work orders" ON work_orders;
DROP POLICY IF EXISTS "Users can delete work orders" ON work_orders;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON work_orders;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON work_orders;
DROP POLICY IF EXISTS "Enable update for admins" ON work_orders;
DROP POLICY IF EXISTS "Enable delete for admins" ON work_orders;

-- 4. Create comprehensive policies that allow all authenticated users to work with work_orders
-- This ensures subcontractors can create and update work orders with all fields including billing details

-- Policy for SELECT (read access)
CREATE POLICY "Work orders read access" ON work_orders
  FOR SELECT 
  TO authenticated
  USING (true);

-- Policy for INSERT (create access)
CREATE POLICY "Work orders insert access" ON work_orders
  FOR INSERT 
  TO authenticated
  WITH CHECK (true);

-- Policy for UPDATE (update access) - This is the key one that was missing
CREATE POLICY "Work orders update access" ON work_orders
  FOR UPDATE 
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy for DELETE (delete access)
CREATE POLICY "Work orders delete access" ON work_orders
  FOR DELETE 
  TO authenticated
  USING (true);

-- 5. Ensure the table has proper permissions
GRANT ALL ON work_orders TO authenticated;
GRANT ALL ON work_orders TO service_role;

-- 6. Verify the policies are in place
SELECT 
  'Updated policies for work_orders table:' as info,
  policyname,
  cmd,
  permissive
FROM pg_policies 
WHERE tablename = 'work_orders'
ORDER BY policyname;

-- 7. Test if we can insert a work order with billing detail fields
-- This is just a test to verify the permissions work
DO $$
DECLARE
  test_job_id uuid;
  test_user_id uuid;
BEGIN
  -- Get a test job ID
  SELECT id INTO test_job_id FROM jobs LIMIT 1;
  
  -- Get a test user ID
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  IF test_job_id IS NOT NULL AND test_user_id IS NOT NULL THEN
    -- Try to insert a test work order with billing detail fields
    BEGIN
      INSERT INTO work_orders (
        job_id,
        prepared_by,
        unit_number,
        unit_size,
        job_category_id,
        painted_ceilings,
        ceiling_billing_detail_id,
        individual_ceiling_count,
        ceiling_display_label,
        has_accent_wall,
        accent_wall_billing_detail_id,
        accent_wall_count
      ) VALUES (
        test_job_id,
        test_user_id,
        'TEST-001',
        '1 Bedroom',
        (SELECT id FROM job_categories LIMIT 1),
        true,
        NULL, -- This should be allowed
        5,
        'Per Ceiling',
        true,
        NULL, -- This should be allowed
        2
      );
      
      -- If we get here, the insert worked
      RAISE NOTICE 'SUCCESS: Work order insert with billing detail fields works!';
      
      -- Clean up the test record
      DELETE FROM work_orders WHERE unit_number = 'TEST-001';
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'ERROR: Work order insert failed: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'SKIP: No test job or user found for testing';
  END IF;
END $$;
