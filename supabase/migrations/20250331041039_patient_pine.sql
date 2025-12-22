/*
  # Fix Work Orders Permissions

  1. Changes
    - Drop existing policies
    - Add new policies for work orders table
    - Remove direct users table access
    - Add proper RLS policies for authenticated users

  2. Security
    - Enable RLS on work_orders table
    - Add policies for authenticated users
*/

-- Drop existing policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON work_orders;
  DROP POLICY IF EXISTS "Enable insert for authenticated users" ON work_orders;
  DROP POLICY IF EXISTS "Enable update for admins" ON work_orders;
  DROP POLICY IF EXISTS "Enable delete for admins" ON work_orders;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

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