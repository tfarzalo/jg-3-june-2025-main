-- Fix RLS policies to allow approval page access to properties
-- Approval pages need to read property data without authentication

-- Add policy to allow public read access to properties for approval pages
CREATE POLICY "Public read access for approval pages" ON properties
  FOR SELECT 
  TO public
  USING (true);

-- Also ensure jobs table allows public read for approval pages
DROP POLICY IF EXISTS "Public read access for approval pages" ON jobs;
CREATE POLICY "Public read access for approval pages" ON jobs
  FOR SELECT
  TO public
  USING (true);
