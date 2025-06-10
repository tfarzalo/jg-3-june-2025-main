/*
  # Create Unit Sizes table

  1. New Tables
    - `unit_sizes`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `created_at` (timestamptz, default now())
  
  2. Security
    - Enable RLS on `unit_sizes` table
    - Add policies for authenticated users to:
      - Create new unit sizes
      - Read all unit sizes
      - Update their own unit sizes
      - Delete their own unit sizes
*/

CREATE TABLE unit_sizes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- Enable Row Level Security
ALTER TABLE unit_sizes ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Allow authenticated users to create unit sizes"
  ON unit_sizes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to view all unit sizes"
  ON unit_sizes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to update their own unit sizes"
  ON unit_sizes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'))
  WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

CREATE POLICY "Allow authenticated users to delete their own unit sizes"
  ON unit_sizes
  FOR DELETE
  TO authenticated
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));