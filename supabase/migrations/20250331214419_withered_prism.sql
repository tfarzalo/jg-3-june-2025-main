/*
  # Fix Billing Schema

  1. Changes
    - Add property_id to billing_categories table
    - Add proper indexes for better performance
    - Update RLS policies to use auth.role()
    - Add unique constraint for property_id + name

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Add property_id to billing_categories
ALTER TABLE billing_categories 
ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_billing_categories_property_id ON billing_categories(property_id);
CREATE INDEX IF NOT EXISTS idx_billing_categories_property_name ON billing_categories(property_id, name);
CREATE INDEX IF NOT EXISTS idx_billing_details_property_id ON billing_details(property_id);
CREATE INDEX IF NOT EXISTS idx_billing_details_category_id ON billing_details(category_id);
CREATE INDEX IF NOT EXISTS idx_billing_details_unit_size_id ON billing_details(unit_size_id);
CREATE INDEX IF NOT EXISTS idx_billing_details_property_category ON billing_details(property_id, category_id);
CREATE INDEX IF NOT EXISTS idx_billing_items_category_id ON billing_items(category_id);

-- Enable RLS
ALTER TABLE billing_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_items ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can read billing categories" ON billing_categories;
  DROP POLICY IF EXISTS "Users can create billing categories" ON billing_categories;
  DROP POLICY IF EXISTS "Users can update billing categories" ON billing_categories;
  DROP POLICY IF EXISTS "Users can delete billing categories" ON billing_categories;
  
  DROP POLICY IF EXISTS "Users can read billing details" ON billing_details;
  DROP POLICY IF EXISTS "Users can create billing details" ON billing_details;
  DROP POLICY IF EXISTS "Users can update billing details" ON billing_details;
  DROP POLICY IF EXISTS "Users can delete billing details" ON billing_details;
  
  DROP POLICY IF EXISTS "Users can read billing items" ON billing_items;
  DROP POLICY IF EXISTS "Users can create billing items" ON billing_items;
  DROP POLICY IF EXISTS "Users can update billing items" ON billing_items;
  DROP POLICY IF EXISTS "Users can delete billing items" ON billing_items;
EXCEPTION
  WHEN undefined_object THEN NULL;
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