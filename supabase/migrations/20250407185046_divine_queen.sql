/*
  # Add assigned_to column to jobs table

  1. Changes
    - Add assigned_to column to jobs table
    - Add index for better query performance
    - Fix billing categories unique constraint issue

  2. Security
    - Maintain existing RLS policies
*/

-- Add assigned_to column to jobs table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name = 'assigned_to'
  ) THEN
    ALTER TABLE jobs ADD COLUMN assigned_to uuid REFERENCES profiles(id);
    CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to ON jobs(assigned_to);
  END IF;
END $$;

-- Drop existing policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Billing categories read access" ON billing_categories;
  DROP POLICY IF EXISTS "Billing categories insert access" ON billing_categories;
  DROP POLICY IF EXISTS "Billing categories update access" ON billing_categories;
  DROP POLICY IF EXISTS "Billing categories delete access" ON billing_categories;
  
  DROP POLICY IF EXISTS "Billing details read access" ON billing_details;
  DROP POLICY IF EXISTS "Billing details insert access" ON billing_details;
  DROP POLICY IF EXISTS "Billing details update access" ON billing_details;
  DROP POLICY IF EXISTS "Billing details delete access" ON billing_details;
  
  DROP POLICY IF EXISTS "Billing items read access" ON billing_items;
  DROP POLICY IF EXISTS "Billing items insert access" ON billing_items;
  DROP POLICY IF EXISTS "Billing items update access" ON billing_items;
  DROP POLICY IF EXISTS "Billing items delete access" ON billing_items;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Fix billing_categories table - ensure property_id column exists
DO $$ BEGIN
  -- Check if property_id column exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'billing_categories' 
    AND column_name = 'property_id'
  ) THEN
    -- Add property_id column if it doesn't exist
    ALTER TABLE billing_categories ADD COLUMN property_id uuid REFERENCES properties(id) ON DELETE CASCADE;
  END IF;
  
  -- Create index for better performance
  CREATE INDEX IF NOT EXISTS idx_billing_categories_property_id ON billing_categories(property_id);
  
  -- Check if unique constraint exists
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'billing_categories_property_id_name_key'
  ) THEN
    -- Add unique constraint for property_id + name
    ALTER TABLE billing_categories ADD CONSTRAINT billing_categories_property_id_name_key UNIQUE (property_id, name);
  END IF;
END $$;

-- Create policies for billing categories
CREATE POLICY "Billing categories read access"
  ON billing_categories
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Billing categories insert access"
  ON billing_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Billing categories update access"
  ON billing_categories
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Billing categories delete access"
  ON billing_categories
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Create policies for billing details
CREATE POLICY "Billing details read access"
  ON billing_details
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Billing details insert access"
  ON billing_details
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Billing details update access"
  ON billing_details
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Billing details delete access"
  ON billing_details
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Create policies for billing items
CREATE POLICY "Billing items read access"
  ON billing_items
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Billing items insert access"
  ON billing_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Billing items update access"
  ON billing_items
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Billing items delete access"
  ON billing_items
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');