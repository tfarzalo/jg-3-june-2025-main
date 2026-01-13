/*
  # Fix Property Management Group Relationships

  1. Changes
    - Drop dependent view first
    - Drop redundant foreign key constraint
    - Drop redundant column
    - Recreate view with updated schema
    - Update RLS policies for properties table

  2. Security
    - Enable RLS on properties table
    - Add policies for CRUD operations
*/

-- First drop the dependent view
DROP VIEW IF EXISTS pmg_with_property_names;

-- Drop the redundant foreign key constraint
ALTER TABLE properties
DROP CONSTRAINT IF EXISTS fk_group_to_properties;

-- Drop the redundant group_id column
ALTER TABLE properties
DROP COLUMN IF EXISTS group_id;

-- Recreate the view with the correct column reference
CREATE OR REPLACE VIEW pmg_with_property_names AS
SELECT 
    pmg.id,
    pmg.company_name,
    ARRAY_AGG(p.property_name) AS property_names
FROM property_management_groups pmg
LEFT JOIN properties p ON p.property_management_group_id = pmg.id
GROUP BY pmg.id, pmg.company_name;

-- Enable RLS on properties table if not already enabled
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view properties" ON properties;
DROP POLICY IF EXISTS "Authenticated users can insert properties" ON properties;
DROP POLICY IF EXISTS "Authenticated users can update properties" ON properties;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON properties;
DROP POLICY IF EXISTS "Enable read access for all users" ON properties;

-- Create new policies for properties table
CREATE POLICY "Enable read access for all users"
ON properties
FOR SELECT
TO public
USING (true);

CREATE POLICY "Enable insert for authenticated users only"
ON properties
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
ON properties
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);