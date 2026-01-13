/*
  # Add Read Policy for Files Table

  1. Changes
    - Add SELECT policy for files table to allow authenticated users to read files
    - Policy allows users to:
      - Read files they uploaded
      - Read files from properties they have access to
      - Read files from jobs they created or have access to

  2. Security
    - Maintains existing RLS security model
    - Adds specific read permissions for authenticated users
*/

-- Drop existing read policy if it exists
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable read access for authenticated users" ON files;
END $$;

-- Create read policy for files table
CREATE POLICY "Enable read access for authenticated users"
  ON files
  FOR SELECT
  TO authenticated
  USING (
    -- Allow access to files the user uploaded
    uploaded_by = auth.uid()
    -- Or files from properties they have access to (if admin)
    OR property_id IN (
      SELECT id FROM properties
      WHERE EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
    -- Or files from jobs they created or have access to (if admin)
    OR job_id IN (
      SELECT id FROM jobs
      WHERE created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
      )
    )
  );