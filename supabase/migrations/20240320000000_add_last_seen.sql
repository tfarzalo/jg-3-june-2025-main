-- Add last_seen column if it doesn't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE;

-- Create function to ensure last_seen column exists
CREATE OR REPLACE FUNCTION ensure_last_seen_column()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Add last_seen column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'last_seen'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE;
  END IF;
END;
$$; 