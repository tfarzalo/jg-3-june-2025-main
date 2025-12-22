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

  -- Create billing unit sizes table
  CREATE TABLE IF NOT EXISTS billing_unit_sizes (
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
    unit_size_id uuid NOT NULL REFERENCES billing_unit_sizes(id),
    bill_amount decimal(10,2) NOT NULL,
    sub_pay_amount decimal(10,2) NOT NULL,
    profit_amount decimal(10,2) NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(property_id, category_id, unit_size_id)
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

-- Create policies for billing unit sizes
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

-- Insert default categories only (no default items or unit sizes)
INSERT INTO billing_categories (name, sort_order) VALUES
  ('Regular Paint', 1),
  ('Ceiling Paint', 2),
  ('Extra Charges', 3),
  ('Unit with High Ceilings', 4)
ON CONFLICT DO NOTHING;