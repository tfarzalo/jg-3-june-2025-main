/*
  # Remove Cabinet and Ceiling Repair Fields

  1. Changes
    - Remove cabinet_removal_repair column from work_orders table
    - Remove ceiling_lights_repair column from work_orders table
    - Drop existing policies to avoid conflicts
    - Recreate policies with proper names

  2. Security
    - Maintain RLS enabled
    - Recreate policies for authenticated users
*/

-- Drop existing policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can read work orders" ON work_orders;
  DROP POLICY IF EXISTS "Users can create work orders" ON work_orders;
  DROP POLICY IF EXISTS "Users can update work orders" ON work_orders;
  DROP POLICY IF EXISTS "Users can delete work orders" ON work_orders;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Remove columns
ALTER TABLE work_orders
DROP COLUMN IF EXISTS cabinet_removal_repair,
DROP COLUMN IF EXISTS ceiling_lights_repair;

-- Enable RLS
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Create new policies
CREATE POLICY "Enable read access for authenticated users"
  ON work_orders
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON work_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
  ON work_orders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users"
  ON work_orders
  FOR DELETE
  TO authenticated
  USING (true);