/*
  # Comprehensive Property Deletion Fix

  1. Changes
    - Check and fix ALL foreign key constraints referencing properties table
    - Ensure all constraints have CASCADE delete
    - Add comprehensive logging to identify remaining issues

  2. Security
    - Maintain existing RLS policies
    - Allow proper cleanup of related data when properties are deleted
*/

-- First, let's see what constraints currently exist
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
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- Fix any remaining constraints that don't have CASCADE
-- This is a comprehensive approach to ensure all constraints are properly set

-- Check and fix any remaining issues with jobs table
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'jobs_property_id_fkey' 
    AND table_name = 'jobs'
    AND constraint_schema = 'public'
  ) THEN
    -- Check if it already has CASCADE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_name = 'jobs_property_id_fkey'
      AND tc.table_name = 'jobs'
      AND tc.constraint_schema = 'public'
      AND rc.delete_rule = 'CASCADE'
    ) THEN
      ALTER TABLE jobs DROP CONSTRAINT jobs_property_id_fkey;
      ALTER TABLE jobs ADD CONSTRAINT jobs_property_id_fkey 
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Check and fix billing_categories table
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'billing_categories_property_id_fkey' 
    AND table_name = 'billing_categories'
    AND constraint_schema = 'public'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_name = 'billing_categories_property_id_fkey'
      AND tc.table_name = 'billing_categories'
      AND tc.constraint_schema = 'public'
      AND rc.delete_rule = 'CASCADE'
    ) THEN
      ALTER TABLE billing_categories DROP CONSTRAINT billing_categories_property_id_fkey;
      ALTER TABLE billing_categories ADD CONSTRAINT billing_categories_property_id_fkey 
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Check and fix files table
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'files_property_id_fkey' 
    AND table_name = 'files'
    AND constraint_schema = 'public'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_name = 'files_property_id_fkey'
      AND tc.table_name = 'files'
      AND tc.constraint_schema = 'public'
      AND rc.delete_rule = 'CASCADE'
    ) THEN
      ALTER TABLE files DROP CONSTRAINT files_property_id_fkey;
      ALTER TABLE files ADD CONSTRAINT files_property_id_fkey 
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Check and fix units table
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'units_property_id_fkey' 
    AND table_name = 'units'
    AND constraint_schema = 'public'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_name = 'units_property_id_fkey'
      AND tc.table_name = 'units'
      AND tc.constraint_schema = 'public'
      AND rc.delete_rule = 'CASCADE'
    ) THEN
      ALTER TABLE units DROP CONSTRAINT units_property_id_fkey;
      ALTER TABLE units ADD CONSTRAINT units_property_id_fkey 
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Check and fix property_paint_schemes table
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'property_paint_schemes_property_id_fkey' 
    AND table_name = 'property_paint_schemes'
    AND constraint_schema = 'public'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_name = 'property_paint_schemes_property_id_fkey'
      AND tc.table_name = 'property_paint_schemes'
      AND tc.constraint_schema = 'public'
      AND rc.delete_rule = 'CASCADE'
    ) THEN
      ALTER TABLE property_paint_schemes DROP CONSTRAINT property_paint_schemes_property_id_fkey;
      ALTER TABLE property_paint_schemes ADD CONSTRAINT property_paint_schemes_property_id_fkey 
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- Fix the circular dependency issue: properties.unit_map_file_id -> files.id
-- We need to set this to NULL when deleting properties, not CASCADE
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'properties_unit_map_file_id_fkey' 
    AND table_name = 'properties'
    AND constraint_schema = 'public'
  ) THEN
    -- Check current delete rule
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints rc
      JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
      WHERE tc.constraint_name = 'properties_unit_map_file_id_fkey'
      AND tc.table_name = 'properties'
      AND tc.constraint_schema = 'public'
      AND rc.delete_rule = 'SET NULL'
    ) THEN
      ALTER TABLE properties DROP CONSTRAINT properties_unit_map_file_id_fkey;
      ALTER TABLE properties ADD CONSTRAINT properties_unit_map_file_id_fkey 
        FOREIGN KEY (unit_map_file_id) REFERENCES files(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- Final verification - show all constraints after fixes
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
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;
