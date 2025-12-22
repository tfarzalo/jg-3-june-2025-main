/*
  # Clean Billing Schema

  1. Changes
    - Drop all existing tables and recreate with proper constraints
    - Remove all default category assignments
    - Add proper RLS policies
    - Add support for hourly rates
    - Ensure no automatic category assignments

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Drop existing tables in correct order
DO $$ BEGIN
  DROP TABLE IF EXISTS billing_details CASCADE;
  DROP TABLE IF EXISTS billing_items CASCADE;
  DROP TABLE IF EXISTS billing_categories CASCADE;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create tables
CREATE TABLE billing_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE billing_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES billing_categories(id) ON DELETE CASCADE,
  unit_size_id uuid NOT NULL REFERENCES unit_sizes(id),
  bill_amount decimal(10,2) NOT NULL,
  sub_pay_amount decimal(10,2) NOT NULL,
  profit_amount decimal(10,2),
  is_hourly boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(property_id, category_id, unit_size_id),
  CONSTRAINT check_hourly_profit CHECK (
    (is_hourly = false AND profit_amount IS NOT NULL) OR 
    (is_hourly = true AND profit_amount IS NULL)
  )
);

CREATE TABLE billing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES billing_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_hourly boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_billing_details_property_id ON billing_details(property_id);
CREATE INDEX idx_billing_details_category_id ON billing_details(category_id);
CREATE INDEX idx_billing_details_unit_size_id ON billing_details(unit_size_id);
CREATE INDEX idx_billing_items_category_id ON billing_items(category_id);

-- Enable RLS
ALTER TABLE billing_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_items ENABLE ROW LEVEL SECURITY;

-- Create policies for billing categories
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

CREATE POLICY "Enable delete for authenticated users"
  ON billing_categories
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Create policies for billing details
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

CREATE POLICY "Enable delete for authenticated users"
  ON billing_details
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

-- Create policies for billing items
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

CREATE POLICY "Enable delete for authenticated users"
  ON billing_items
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');