/*
  # Create Jobs Table

  1. New Tables
    - `jobs`
      - `id` (uuid, primary key)
      - `property_id` (uuid, FK to properties)
      - `unit_number` (text)
      - `unit_size_id` (uuid, FK to unit_sizes)
      - `job_type_id` (uuid, FK to job_types)
      - `description` (text)
      - `scheduled_date` (date)
      - `status` (text)
      - `created_by` (uuid, FK to auth.users)
      - `created_at` (timestamp with timezone)
      - `updated_at` (timestamp with timezone)

  2. Security
    - Enable RLS on `jobs` table
    - Add policies for:
      - Authenticated users can create jobs
      - Users can view their own jobs
      - Users can update their own jobs
      - Admins can view and update all jobs
*/

-- Create jobs table
CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id) NOT NULL,
  unit_number text NOT NULL,
  unit_size_id uuid REFERENCES unit_sizes(id) NOT NULL,
  job_type_id uuid REFERENCES job_types(id) NOT NULL,
  description text,
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'Open',
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can create jobs"
  ON jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view their own jobs"
  ON jobs
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can update their own jobs"
  ON jobs
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create trigger function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();