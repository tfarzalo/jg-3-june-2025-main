/*
  # Add Work Orders Schema

  1. New Tables
    - work_orders
      - Stores work order details for jobs
      - Links to jobs table
      - Includes all form fields for work order information

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create work_orders table
CREATE TABLE IF NOT EXISTS work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id),
  prepared_by uuid NOT NULL REFERENCES auth.users(id),
  submission_date timestamptz NOT NULL DEFAULT now(),
  unit_number text NOT NULL,
  
  -- Unit Information
  is_occupied boolean NOT NULL DEFAULT false,
  is_full_paint boolean NOT NULL DEFAULT false,
  paint_type text NOT NULL,
  has_sprinklers boolean NOT NULL DEFAULT false,
  sprinklers_painted boolean NOT NULL DEFAULT false,
  sprinkler_photo_path text,
  sprinkler_head_photo_path text,
  
  -- Painted Items
  painted_ceilings boolean NOT NULL DEFAULT false,
  ceiling_rooms_count integer,
  painted_patio boolean NOT NULL DEFAULT false,
  painted_garage boolean NOT NULL DEFAULT false,
  painted_cabinets boolean NOT NULL DEFAULT false,
  painted_crown_molding boolean NOT NULL DEFAULT false,
  painted_front_door boolean NOT NULL DEFAULT false,
  cabinet_removal_repair text,
  ceiling_lights_repair text,
  
  -- Accent Wall Information
  has_accent_wall boolean NOT NULL DEFAULT false,
  accent_wall_type text,
  accent_wall_count integer,
  
  -- Prep Work Information
  has_extra_charges boolean NOT NULL DEFAULT false,
  extra_charges_description text,
  extra_hours integer,
  
  -- Other
  additional_comments text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT valid_paint_type CHECK (
    paint_type IN ('Regular Paint', 'Color Change')
  ),
  CONSTRAINT valid_accent_wall_type CHECK (
    accent_wall_type IS NULL OR 
    accent_wall_type IN ('Custom', 'Paint Over')
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_work_orders_job_id ON work_orders(job_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_prepared_by ON work_orders(prepared_by);

-- Enable RLS
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for authenticated users"
  ON work_orders
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON work_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update for admins"
  ON work_orders
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Enable delete for admins"
  ON work_orders
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create trigger for updating updated_at
CREATE OR REPLACE FUNCTION update_work_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_work_orders_updated_at();