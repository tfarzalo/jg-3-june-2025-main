-- Enable RLS on work_orders table
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON work_orders;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON work_orders;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON work_orders;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON work_orders;
DROP POLICY IF EXISTS "Users can read work orders" ON work_orders;
DROP POLICY IF EXISTS "Users can create work orders" ON work_orders;
DROP POLICY IF EXISTS "Users can update work orders" ON work_orders;
DROP POLICY IF EXISTS "Users can delete work orders" ON work_orders;

-- Create policies for work_orders table
CREATE POLICY "Enable insert for authenticated users"
ON work_orders
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable read for authenticated users"
ON work_orders
FOR SELECT
TO authenticated
USING (true);

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

-- Grant necessary permissions to authenticated users
GRANT ALL ON work_orders TO authenticated;

-- Grant necessary permissions to the service role
GRANT ALL ON work_orders TO service_role; 