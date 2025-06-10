/*
  # Add property_id to jobs table

  1. Changes
    - Add property_id column to jobs table with foreign key reference to properties
    - Add index for better query performance

  2. Notes
    - Creates relation between jobs and properties
    - Improves query performance with index
*/

-- Add property_id to jobs table
ALTER TABLE jobs ADD COLUMN property_id uuid REFERENCES properties(id);

-- Add index for better query performance
CREATE INDEX idx_jobs_property_id ON jobs(property_id);