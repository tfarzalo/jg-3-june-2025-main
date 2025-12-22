/*
  # Fix Property Deletion Cascade Constraints

  1. Changes
    - Add ON DELETE CASCADE to jobs.property_id foreign key
    - Add ON DELETE CASCADE to billing_categories.property_id foreign key
    - Ensure all property references can be properly deleted

  2. Security
    - Maintain existing RLS policies
    - Allow proper cleanup of related data when properties are deleted
*/

-- First, check if the foreign key constraint exists and drop it if it does
DO $$ 
BEGIN
  -- Drop existing foreign key constraint on jobs.property_id if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'jobs_property_id_fkey' 
    AND table_name = 'jobs'
  ) THEN
    ALTER TABLE jobs DROP CONSTRAINT jobs_property_id_fkey;
  END IF;
END $$;

-- Add the foreign key constraint with CASCADE delete
ALTER TABLE jobs 
ADD CONSTRAINT jobs_property_id_fkey 
FOREIGN KEY (property_id) 
REFERENCES properties(id) 
ON DELETE CASCADE;

-- Check and fix billing_categories.property_id constraint
DO $$ 
BEGIN
  -- Drop existing foreign key constraint on billing_categories.property_id if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'billing_categories_property_id_fkey' 
    AND table_name = 'billing_categories'
  ) THEN
    ALTER TABLE billing_categories DROP CONSTRAINT billing_categories_property_id_fkey;
  END IF;
END $$;

-- Add the foreign key constraint with CASCADE delete
ALTER TABLE billing_categories 
ADD CONSTRAINT billing_categories_property_id_fkey 
FOREIGN KEY (property_id) 
REFERENCES properties(id) 
ON DELETE CASCADE;

-- Fix files table constraint
DO $$ 
BEGIN
  -- Drop existing foreign key constraint on files.property_id if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'files_property_id_fkey' 
    AND table_name = 'files'
  ) THEN
    ALTER TABLE files DROP CONSTRAINT files_property_id_fkey;
  END IF;
END $$;

-- Add the foreign key constraint with CASCADE delete
ALTER TABLE files 
ADD CONSTRAINT files_property_id_fkey 
FOREIGN KEY (property_id) 
REFERENCES properties(id) 
ON DELETE CASCADE;

-- Fix units table constraint
DO $$ 
BEGIN
  -- Drop existing foreign key constraint on units.property_id if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'units_property_id_fkey' 
    AND table_name = 'units'
  ) THEN
    ALTER TABLE units DROP CONSTRAINT units_property_id_fkey;
  END IF;
END $$;

-- Add the foreign key constraint with CASCADE delete
ALTER TABLE units 
ADD CONSTRAINT units_property_id_fkey 
FOREIGN KEY (property_id) 
REFERENCES properties(id) 
ON DELETE CASCADE;

-- Verify the constraints are properly set
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
  AND tc.table_schema = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'properties'
  AND tc.table_schema = 'public';
