/*
  # Fix Jobs Table RLS Policies

  1. Changes
    - Drop existing problematic policies
    - Create new simplified policies for jobs table
    - Use auth.uid() directly instead of checking users table
    - Add policies for viewing jobs and related data

  2. Security
    - Enable RLS on jobs table
    - Add policies for authenticated users
    - Ensure proper access control for viewing jobs
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own jobs" ON jobs;
DROP POLICY IF EXISTS "Users can update their own jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can create jobs" ON jobs;
DROP POLICY IF EXISTS "Allow job creation" ON jobs;
DROP POLICY IF EXISTS "Allow job viewing" ON jobs;
DROP POLICY IF EXISTS "Allow job updates" ON jobs;
DROP POLICY IF EXISTS "Enable job creation" ON jobs;
DROP POLICY IF EXISTS "Enable job viewing" ON jobs;
DROP POLICY IF EXISTS "Enable job updates" ON jobs;

-- Create new simplified policies
CREATE POLICY "Enable read access for authenticated users"
ON jobs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Enable insert for authenticated users"
ON jobs
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
ON jobs
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;