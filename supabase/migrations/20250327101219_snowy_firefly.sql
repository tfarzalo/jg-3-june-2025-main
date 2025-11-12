/*
  # Create job types table

  1. New Tables
    - `job_types`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `created_at` (timestamp with timezone)

  2. Security
    - Enable RLS on `job_types` table
    - Add policies for authenticated users to:
      - Create new job types
      - View all job types
      - Update job types (admin only)
      - Delete job types (admin only)
*/

-- Create the job_types table
CREATE TABLE job_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Enable Row Level Security
ALTER TABLE job_types ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Allow authenticated users to create job types"
  ON job_types
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view all job types"
  ON job_types
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins to update job types"
  ON job_types
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY "Allow admins to delete job types"
  ON job_types
  FOR DELETE
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));