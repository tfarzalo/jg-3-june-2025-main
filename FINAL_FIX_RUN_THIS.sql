-- Complete fix: Drop and recreate the constraint with correct regex
-- Run this in your Supabase SQL Editor

BEGIN;

-- Drop the constraint
ALTER TABLE files DROP CONSTRAINT IF EXISTS valid_file_type;

-- Recreate with correct regex (dash at the end of character class)
ALTER TABLE files ADD CONSTRAINT valid_file_type 
  CHECK (type ~ '^[a-zA-Z0-9]+/[a-zA-Z0-9+.-]+$');

-- Verify it was created correctly
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'files' AND conname = 'valid_file_type';

COMMIT;
