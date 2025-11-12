/*
  # Fix property management group reference

  1. Changes
    - Clean up invalid property_management_group_id values
    - Update property_management_group_id column type to uuid
    - Add foreign key constraint to property_management_groups table
    - Enable RLS on properties table
    - Add policies for property access

  2. Security
    - Enable RLS on properties table
    - Add policies for viewing, inserting, and updating properties
*/

-- First, remove invalid property_management_group_id values
UPDATE properties 
SET property_management_group_id = NULL 
WHERE property_management_group_id = '' OR property_management_group_id IS NULL;

-- Update column type to match referenced column
ALTER TABLE properties 
ALTER COLUMN property_management_group_id TYPE uuid USING 
  CASE 
    WHEN property_management_group_id IS NULL THEN NULL 
    ELSE property_management_group_id::uuid 
  END;

-- Add foreign key constraint
ALTER TABLE properties
ADD CONSTRAINT fk_property_management_group
FOREIGN KEY (property_management_group_id)
REFERENCES property_management_groups(id)
ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Anyone can view properties"
ON properties
FOR SELECT
TO public
USING (true);

CREATE POLICY "Authenticated users can insert properties"
ON properties
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update properties"
ON properties
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);