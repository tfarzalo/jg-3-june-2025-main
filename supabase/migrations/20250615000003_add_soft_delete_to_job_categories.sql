-- Add is_hidden column to job_categories for soft delete
ALTER TABLE job_categories 
ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

COMMENT ON COLUMN job_categories.is_hidden IS 'If true, this category is soft-deleted and should not appear in lists, but preserves historical data references.';
