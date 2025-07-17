/*
  # Add Folder Column to Files Table

  1. Changes
    - Add folder column to files table
    - This column will store the folder name (e.g., "work_orders", "sprinklers")
    - Default value is NULL for backward compatibility
*/

-- Add folder column to files table
ALTER TABLE files
ADD COLUMN IF NOT EXISTS folder text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder);

-- Update existing files to have folder based on path
UPDATE files
SET folder = SPLIT_PART(path, '/', 3)
WHERE folder IS NULL
AND path LIKE '%/%/%'; 