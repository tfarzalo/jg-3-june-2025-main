/*
  # Create Property Management Groups Table

  1. New Tables
    - `property_management_groups`
      - `id` (uuid, primary key)
      - `company_name` (text, not null)
      - `address` (text, not null)
      - `address_2` (text)
      - `city` (text, not null)
      - `state` (text, not null)
      - `zip` (text, not null)
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)

  2. Security
    - Enable RLS on `property_management_groups` table
    - Add policies for authenticated users to read all records
    - Add policies for admin users to manage all records
*/

CREATE TABLE IF NOT EXISTS property_management_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  address text NOT NULL,
  address_2 text,
  city text NOT NULL,
  state text NOT NULL,
  zip text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE property_management_groups ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Users can view all property management groups"
  ON property_management_groups
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to manage all records
CREATE POLICY "Admins can manage all property management groups"
  ON property_management_groups
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );