/*
  # Create job phase changes tracking table

  1. New Tables
    - `job_phase_changes`
      - `id` (uuid, primary key)
      - `job_id` (uuid, not null) - Will be linked to jobs table later
      - `changed_by` (uuid, not null) - Will be linked to users/profiles table later
      - `from_phase_id` (uuid, nullable, FK to job_phases)
      - `to_phase_id` (uuid, not null, FK to job_phases)
      - `change_reason` (text, nullable)
      - `changed_at` (timestamp with timezone)

  2. Security
    - Enable RLS on `job_phase_changes` table
    - Add policies for authenticated users to:
      - Create new phase changes
      - View all phase changes
      - Update their own changes (if owner)
      - Delete their own changes (if owner or admin)

  3. Foreign Keys
    - from_phase_id references job_phases(id)
    - to_phase_id references job_phases(id)
    - Other FKs (job_id, changed_by) will be added later when referenced tables exist
*/

-- Create the job_phase_changes table
CREATE TABLE job_phase_changes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  from_phase_id uuid,
  to_phase_id uuid NOT NULL,
  change_reason text,
  changed_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (from_phase_id) REFERENCES job_phases(id),
  FOREIGN KEY (to_phase_id) REFERENCES job_phases(id)
);

-- Enable Row Level Security
ALTER TABLE job_phase_changes ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Allow authenticated users to create phase changes"
  ON job_phase_changes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view all phase changes"
  ON job_phase_changes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow users to update their own phase changes"
  ON job_phase_changes
  FOR UPDATE
  TO authenticated
  USING (changed_by = auth.uid())
  WITH CHECK (changed_by = auth.uid());

CREATE POLICY "Allow users to delete their own phase changes or if admin"
  ON job_phase_changes
  FOR DELETE
  TO authenticated
  USING (
    changed_by = auth.uid() OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );