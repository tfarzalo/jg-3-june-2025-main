/*
  # Add Property Callbacks and Updates Tables

  1. New Tables
    - `property_callbacks` - Track callback information for properties
    - `property_updates` - Track updates and notes for properties

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create property_callbacks table
CREATE TABLE IF NOT EXISTS property_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  callback_date date NOT NULL,
  painter text,
  unit_number text NOT NULL,
  reason text NOT NULL,
  posted_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create property_updates table
CREATE TABLE IF NOT EXISTS property_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  update_date date NOT NULL,
  update_type text NOT NULL,
  note text NOT NULL,
  posted_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_property_callbacks_property_id ON property_callbacks(property_id);
CREATE INDEX idx_property_callbacks_callback_date ON property_callbacks(callback_date);
CREATE INDEX idx_property_updates_property_id ON property_updates(property_id);
CREATE INDEX idx_property_updates_update_date ON property_updates(update_date);

-- Enable RLS
ALTER TABLE property_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_updates ENABLE ROW LEVEL SECURITY;

-- Create policies for property_callbacks
CREATE POLICY "Enable read access for authenticated users"
  ON property_callbacks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON property_callbacks
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
  ON property_callbacks
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users"
  ON property_callbacks
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for property_updates
CREATE POLICY "Enable read access for authenticated users"
  ON property_updates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON property_updates
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
  ON property_updates
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users"
  ON property_updates
  FOR DELETE
  TO authenticated
  USING (true);

-- Create trigger functions to update updated_at
CREATE OR REPLACE FUNCTION update_property_callbacks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_property_updates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_property_callbacks_updated_at
  BEFORE UPDATE ON property_callbacks
  FOR EACH ROW
  EXECUTE FUNCTION update_property_callbacks_updated_at();

CREATE TRIGGER update_property_updates_updated_at
  BEFORE UPDATE ON property_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_property_updates_updated_at();