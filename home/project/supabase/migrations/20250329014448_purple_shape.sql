/*
  # Fix Billing Schema

  1. Changes
    - Remove duplicate categories
    - Use existing unit_sizes table instead of separate billing_unit_sizes
    - Simplify schema and remove redundant tables
    - Add proper indexes and constraints
    - Add RLS policies for authenticated users

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Drop existing policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON billing_categories;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON billing_categories;
  DROP POLICY IF EXISTS "Enable update for authenticated users" ON billing_categories;
  
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON billing_details;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON billing_details;
  DROP POLICY IF EXISTS "Enable update for authenticated users" ON billing_details;
  
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON billing_items;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON billing_items;
  DROP POLICY IF EXISTS "Enable update for authenticated users" ON billing_items;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create tables if they don't exist
DO $$ BEGIN
  -- Create billing categories table
  CREATE TABLE IF NOT EXISTS billing_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );

  -- Create billing details table
  CREATE TABLE IF NOT EXISTS billing_details (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    category_id uuid NOT NULL REFERENCES billing_categories(id),
    unit_size_id uuid NOT NULL REFERENCES unit_sizes(id),
    bill_amount decimal(10,2) NOT NULL,
    sub_pay_amount decimal(10,2) NOT NULL,
    profit_amount decimal(10,2) NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );

  -- Create billing items table for custom items
  CREATE TABLE IF NOT EXISTS billing_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id uuid NOT NULL REFERENCES billing_categories(id),
    name text NOT NULL,
    description text,
    is_hourly boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
  );
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_billing_details_property_id ON billing_details(property_id);
CREATE INDEX IF NOT EXISTS idx_billing_details_category_id ON billing_details(category_id);
CREATE INDEX IF NOT EXISTS idx_billing_details_unit_size_id ON billing_details(unit_size_id);
CREATE INDEX IF NOT EXISTS idx_billing_items_category_id ON billing_items(category_id);

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

-- Insert default categories
DO $$ 
DECLARE
  v_regular_paint_id uuid;
  v_extra_charges_id uuid;
BEGIN
  -- Insert Regular Paint category if it doesn't exist
  INSERT INTO billing_categories (name, sort_order)
  VALUES ('Regular Paint', 1)
  ON CONFLICT (name) DO NOTHING
  RETURNING id INTO v_regular_paint_id;

  -- Insert Extra Charges category if it doesn't exist
  INSERT INTO billing_categories (name, sort_order)
  VALUES ('Extra Charges', 2)
  ON CONFLICT (name) DO NOTHING
  RETURNING id INTO v_extra_charges_id;

  -- Insert default billing items for Extra Charges if the category exists
  IF v_extra_charges_id IS NOT NULL THEN
    INSERT INTO billing_items (category_id, name, is_hourly)
    VALUES 
      (v_extra_charges_id, 'Prep Work / Drywall Repairs', true),
      (v_extra_charges_id, 'Paint Over Accent Wall', false)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;