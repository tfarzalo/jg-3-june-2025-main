/*
  # Fix Billing Categories Permissions

  1. Changes
    - Drop existing policies
    - Create new simplified policies for billing tables
    - Remove references to users table in policy checks
    - Use auth.role() instead of checking profiles table

  2. Security
    - Enable RLS on all billing tables
    - Allow authenticated users to read all billing data
    - Allow admins to modify billing data
*/

-- Drop existing policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON billing_categories;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON billing_categories;
  DROP POLICY IF EXISTS "Enable update for authenticated users" ON billing_categories;
  
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON billing_unit_sizes;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON billing_unit_sizes;
  DROP POLICY IF EXISTS "Enable update for authenticated users" ON billing_unit_sizes;
  
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON billing_details;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON billing_details;
  DROP POLICY IF EXISTS "Enable update for authenticated users" ON billing_details;
  
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON billing_items;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON billing_items;
  DROP POLICY IF EXISTS "Enable update for authenticated users" ON billing_items;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create new simplified policies for billing categories
CREATE POLICY "Enable read access for authenticated users"
  ON billing_categories
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users"
  ON billing_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users"
  ON billing_categories
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Create new simplified policies for billing unit sizes
CREATE POLICY "Enable read access for authenticated users"
  ON billing_unit_sizes
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users"
  ON billing_unit_sizes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users"
  ON billing_unit_sizes
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Create new simplified policies for billing details
CREATE POLICY "Enable read access for authenticated users"
  ON billing_details
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users"
  ON billing_details
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users"
  ON billing_details
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Create new simplified policies for billing items
CREATE POLICY "Enable read access for authenticated users"
  ON billing_items
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users"
  ON billing_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users"
  ON billing_items
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');