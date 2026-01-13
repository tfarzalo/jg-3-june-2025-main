/*
  # Add Archive Columns to Properties and Property Management Groups

  1. Changes
    - Add is_archived column to properties table
    - Add is_archived column to property_management_groups table
    - Set default value to false for both columns
    - Add indexes for better query performance

  2. Security
    - Maintain existing RLS policies
*/

-- Add is_archived column to properties table if it doesn't exist
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Add is_archived column to property_management_groups table if it doesn't exist
ALTER TABLE property_management_groups
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_properties_is_archived ON properties(is_archived);
CREATE INDEX IF NOT EXISTS idx_property_management_groups_is_archived ON property_management_groups(is_archived);