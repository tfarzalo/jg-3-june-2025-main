-- Add a 'category' column to the files table for file type
ALTER TABLE files ADD COLUMN category text;
-- Optionally, add a check constraint for allowed values
ALTER TABLE files ADD CONSTRAINT files_category_check CHECK (category IN ('before', 'sprinkler', 'other')); 