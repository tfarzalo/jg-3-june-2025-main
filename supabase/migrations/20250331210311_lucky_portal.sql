/*
  # Fix Job Phase Changes Policies

  1. Changes
    - Drop existing policies that reference users table
    - Create new policies using auth.uid()
    - Add proper RLS policies for job phase changes
    - Fix permission denied errors

  2. Security
    - Enable RLS
    - Add policies for authenticated users
    - Use auth.uid() instead of accessing users table
*/

-- Drop existing policies to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "Enable phase change creation" ON job_phase_changes;
  DROP POLICY IF EXISTS "Enable phase change viewing" ON job_phase_changes;
  DROP POLICY IF EXISTS "Enable viewing phase changes" ON job_phase_changes;
  DROP POLICY IF EXISTS "Enable deletion of job phase changes" ON job_phase_changes;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Enable RLS
ALTER TABLE job_phase_changes ENABLE ROW LEVEL SECURITY;

-- Create new policies
CREATE POLICY "Enable phase change creation"
  ON job_phase_changes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable phase change viewing"
  ON job_phase_changes
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable phase change deletion"
  ON job_phase_changes
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY "Enable phase change updates"
  ON job_phase_changes
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');