/*
  # Create Billing Details Schema

  1. New Tables
    - `billing_categories` - Parent categories like "Regular Paint", "Ceiling Paint"
    - `billing_unit_sizes` - Unit sizes like "2 Bedroom", "3 Bedroom"
    - `billing_details` - Main billing information per property and category
    - `billing_items` - Individual billing items under categories

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create billing categories table
CREATE TABLE billing_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create billing unit sizes table
CREATE TABLE billing_unit_sizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create billing details table
CREATE TABLE billing_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES billing_categories(id),
  unit_size_id uuid NOT NULL REFERENCES billing_unit_sizes(id),
  bill_amount decimal(10,2) NOT NULL,
  sub_pay_amount decimal(10,2) NOT NULL,
  profit_amount decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(property_id, category_id, unit_size_id)
);

-- Create billing items table for custom items
CREATE TABLE billing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES billing_categories(id),
  name text NOT NULL,
  description text,
  is_hourly boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE billing_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_unit_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_items ENABLE ROW LEVEL SECURITY;

-- Create policies for billing categories
CREATE POLICY "Enable read access for authenticated users"
  ON billing_categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON billing_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Enable update for authenticated users"
  ON billing_categories
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create policies for billing unit sizes
CREATE POLICY "Enable read access for authenticated users"
  ON billing_unit_sizes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON billing_unit_sizes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Enable update for authenticated users"
  ON billing_unit_sizes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create policies for billing details
CREATE POLICY "Enable read access for authenticated users"
  ON billing_details
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON billing_details
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Enable update for authenticated users"
  ON billing_details
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create policies for billing items
CREATE POLICY "Enable read access for authenticated users"
  ON billing_items
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON billing_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Enable update for authenticated users"
  ON billing_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insert default categories
INSERT INTO billing_categories (name, sort_order) VALUES
  ('Regular Paint', 1),
  ('Ceiling Paint', 2),
  ('Extra Charges', 3),
  ('Unit with High Ceilings', 4);

-- Insert default unit sizes
INSERT INTO billing_unit_sizes (name, sort_order) VALUES
  ('2 Bedroom', 1),
  ('3 Bedroom', 2);

-- Insert default billing items
INSERT INTO billing_items (category_id, name, is_hourly) VALUES
  ((SELECT id FROM billing_categories WHERE name = 'Extra Charges'), 'Prep Work / Drywall Repairs', true),
  ((SELECT id FROM billing_categories WHERE name = 'Extra Charges'), 'Paint Over Accent Wall', false);