/*
  # Fix Work Orders Policies

  1. Changes
    - Drop all existing policies
    - Recreate policies with unique names
    - Enable RLS
    - Add policies for authenticated users

  2. Security
    - Enable RLS on work_orders table
    - Add policies for authenticated users
*/

-- Drop existing policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON work_orders;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON work_orders;
  DROP POLICY IF EXISTS "Enable update for authenticated users" ON work_orders;
  DROP POLICY IF EXISTS "Enable delete for authenticated users" ON work_orders;
  DROP POLICY IF EXISTS "Enable update for admins" ON work_orders;
  DROP POLICY IF EXISTS "Enable delete for admins" ON work_orders;
  DROP POLICY IF EXISTS "Users can read work orders" ON work_orders;
  DROP POLICY IF EXISTS "Users can create work orders" ON work_orders;
  DROP POLICY IF EXISTS "Users can update work orders" ON work_orders;
  DROP POLICY IF EXISTS "Users can delete work orders" ON work_orders;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Create new policies with unique names
CREATE POLICY "Users can read work orders"
  ON work_orders
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create work orders"
  ON work_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update work orders"
  ON work_orders
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete work orders"
  ON work_orders
  FOR DELETE
  TO authenticated
  USING (true);