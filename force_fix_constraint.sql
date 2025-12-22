-- Double-check: force drop and recreate the constraint
ALTER TABLE files DROP CONSTRAINT IF EXISTS valid_file_type CASCADE;

-- Recreate with absolutely correct regex (dash at the very end, unescaped)
ALTER TABLE files ADD CONSTRAINT valid_file_type 
  CHECK (type ~ '^[a-zA-Z0-9]+/[a-zA-Z0-9+.-]+$');

-- Verify it was created
SELECT 
    conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE t.relname = 'files'
  AND conname = 'valid_file_type';
