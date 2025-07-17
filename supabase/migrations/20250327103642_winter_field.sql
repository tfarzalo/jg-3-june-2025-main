/*
  # Create units and jobs tables with work order tracking

  1. New Tables
    - `units` table for storing unit information
      - `id` (uuid, primary key)
      - `unit_number` (text)
      - `property_id` (uuid, FK to properties)
      - `created_at` (timestamp with timezone)
      - `updated_at` (timestamp with timezone)
    
    - `jobs` table for work order management
      - `id` (uuid, primary key)
      - `work_order_num` (integer, unique, auto-incrementing)
      - `unit_id` (uuid, FK to units)
      - `job_type_id` (uuid, FK to job_types)
      - Plus additional tracking fields

  2. Views
    - `work_orders_view` for formatted work order numbers (WO-000123)

  3. Security
    - Enable RLS on both tables
    - Add appropriate policies for CRUD operations
*/

-- Create the units table first
CREATE TABLE units (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  unit_number text NOT NULL,
  property_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (property_id) REFERENCES properties(id)
);

-- Enable RLS on units
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for units
CREATE POLICY "Allow authenticated users to create units"
  ON units
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view all units"
  ON units
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update units"
  ON units
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow admins to delete units"
  ON units
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Create sequence for work order numbers
CREATE SEQUENCE work_order_num_seq START 1;

-- Create the jobs table
CREATE TABLE jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  work_order_num integer NOT NULL DEFAULT nextval('work_order_num_seq'),
  unit_id uuid NOT NULL,
  job_type_id uuid NOT NULL,
  scheduled_date date,
  due_date date,
  completed_date date,
  description text,
  status text NOT NULL,
  created_by uuid,
  assigned_to uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (work_order_num),
  FOREIGN KEY (unit_id) REFERENCES units(id),
  FOREIGN KEY (job_type_id) REFERENCES job_types(id)
);

-- Create view for formatted work order numbers
CREATE VIEW work_orders_view AS
SELECT 
  id,
  'WO-' || LPAD(work_order_num::text, 6, '0') AS work_order_id,
  unit_id,
  job_type_id,
  scheduled_date,
  due_date,
  completed_date,
  description,
  status,
  created_by,
  assigned_to,
  created_at,
  updated_at
FROM jobs;

-- Enable Row Level Security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Allow authenticated users to create jobs
CREATE POLICY "Allow authenticated users to create jobs"
  ON jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to view jobs they created or are assigned to
CREATE POLICY "Allow users to view their jobs"
  ON jobs
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid() OR 
    assigned_to = auth.uid() OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Allow users to update jobs they created or are assigned to
CREATE POLICY "Allow users to update their jobs"
  ON jobs
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid() OR 
    assigned_to = auth.uid() OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  )
  WITH CHECK (
    created_by = auth.uid() OR 
    assigned_to = auth.uid() OR
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

-- Allow only admins to delete jobs
CREATE POLICY "Allow admins to delete jobs"
  ON jobs
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );