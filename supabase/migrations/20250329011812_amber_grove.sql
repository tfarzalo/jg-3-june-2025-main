-- Drop existing policies first to avoid conflicts
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

-- Insert default data if tables are empty
DO $$ 
DECLARE
  category_count integer;
  unit_size_count integer;
  extra_charges_id uuid;
BEGIN
  -- Check if categories table is empty
  SELECT COUNT(*) INTO category_count FROM billing_categories;
  
  IF category_count = 0 THEN
    -- Insert default categories
    INSERT INTO billing_categories (name, sort_order) VALUES
      ('Regular Paint', 1),
      ('Ceiling Paint', 2),
      ('Extra Charges', 3),
      ('Unit with High Ceilings', 4);
  END IF;

  -- Check if unit sizes table is empty
  SELECT COUNT(*) INTO unit_size_count FROM billing_unit_sizes;
  
  IF unit_size_count = 0 THEN
    -- Insert default unit sizes
    INSERT INTO billing_unit_sizes (name, sort_order) VALUES
      ('2 Bedroom', 1),
      ('3 Bedroom', 2);
  END IF;

  -- Get Extra Charges category ID
  SELECT id INTO extra_charges_id FROM billing_categories WHERE name = 'Extra Charges' LIMIT 1;
  
  IF extra_charges_id IS NOT NULL THEN
    -- Insert default billing items if they don't exist
    INSERT INTO billing_items (category_id, name, is_hourly)
    SELECT extra_charges_id, 'Prep Work / Drywall Repairs', true
    WHERE NOT EXISTS (
      SELECT 1 FROM billing_items 
      WHERE category_id = extra_charges_id 
      AND name = 'Prep Work / Drywall Repairs'
    );

    INSERT INTO billing_items (category_id, name, is_hourly)
    SELECT extra_charges_id, 'Paint Over Accent Wall', false
    WHERE NOT EXISTS (
      SELECT 1 FROM billing_items 
      WHERE category_id = extra_charges_id 
      AND name = 'Paint Over Accent Wall'
    );
  END IF;
END $$;