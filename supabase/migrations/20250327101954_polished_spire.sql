/*
  # Create job phases table and insert initial data

  1. New Tables
    - `job_phases`
      - `id` (uuid, primary key)
      - `job_phase_label` (text, not null)
      - `color_light_mode` (text, not null)
      - `color_dark_mode` (text, not null)
      - `sort_order` (integer, not null)
      - `order_index` (integer, not null)
      - `created_at` (timestamp with timezone)

  2. Security
    - Enable RLS on `job_phases` table
    - Add policies for authenticated users to:
      - Create new job phases
      - View all job phases
      - Update job phases (admin only)
      - Delete job phases (admin only)

  3. Initial Data
    - Insert predefined job phases with their respective colors and order
*/

-- Create the job_phases table
CREATE TABLE job_phases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_phase_label text NOT NULL,
  color_light_mode text NOT NULL,
  color_dark_mode text NOT NULL,
  sort_order integer NOT NULL,
  order_index integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Enable Row Level Security
ALTER TABLE job_phases ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Allow authenticated users to create job phases"
  ON job_phases
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view all job phases"
  ON job_phases
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins to update job phases"
  ON job_phases
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY "Allow admins to delete job phases"
  ON job_phases
  FOR DELETE
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- Insert initial job phases
INSERT INTO job_phases (job_phase_label, color_light_mode, color_dark_mode, sort_order, order_index)
VALUES
  ('Job Request', '#E5E7EB', '#374151', 1, 1),
  ('Work Order', '#FEF3C7', '#92400E', 2, 2),
  ('Pending Work Order', '#FEE2E2', '#991B1B', 3, 3),
  ('Invoicing', '#DCFCE7', '#166534', 4, 4),
  ('Completed', '#DBEAFE', '#1E40AF', 5, 5),
  ('Cancelled', '#F3F4F6', '#4B5563', 6, 6);