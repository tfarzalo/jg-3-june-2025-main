-- Add updated_at column to files table for tracking file modifications
ALTER TABLE public.files 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now() NOT NULL;

-- Create an index on updated_at for sorting/querying by modification time
CREATE INDEX IF NOT EXISTS idx_files_updated_at ON public.files(updated_at);

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS set_updated_at ON public.files;

-- Create the trigger
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.files
    FOR EACH ROW
    EXECUTE FUNCTION update_files_updated_at();
