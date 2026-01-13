-- Enable RLS on files table
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON files;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON files;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON files;

-- Create policies for files table
CREATE POLICY "Enable insert for authenticated users"
ON files
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable read for authenticated users"
ON files
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable update for authenticated users"
ON files
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant necessary permissions to authenticated users
GRANT ALL ON files TO authenticated;

-- Grant necessary permissions to the service role
GRANT ALL ON files TO service_role; 