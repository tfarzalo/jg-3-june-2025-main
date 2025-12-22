-- Fix the check constraint 'valid_file_type' on the 'files' table
-- The error "new row for relation "files" violates check constraint "valid_file_type""
-- indicates that the content type 'text/csv;charset=utf-8' is not allowed by the current constraint.

-- 1. Drop the existing restrictive constraint
ALTER TABLE files DROP CONSTRAINT IF EXISTS valid_file_type;

-- 2. Add a new, more permissible constraint (or just rely on application validation)
-- Option A: Allow any non-empty string (Recommended for flexibility)
ALTER TABLE files ADD CONSTRAINT valid_file_type CHECK (length(type) > 0);

-- Option B: Update the list to include charset parameters (If you really want a list)
-- This is brittle because MIME types can have parameters like ';charset=utf-8'
-- ALTER TABLE files ADD CONSTRAINT valid_file_type CHECK (
--   type IN (
--     'application/pdf',
--     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
--     'application/vnd.ms-excel',
--     'text/csv',
--     'text/csv;charset=utf-8',  <-- This was likely missing
--     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
--     'application/msword',
--     'text/plain',
--     'text/html',
--     'image/jpeg',
--     'image/png',
--     'image/gif',
--     'image/webp'
--   )
-- );
