DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'files' AND column_name = 'original_size'
  ) THEN
    ALTER TABLE files ADD COLUMN original_size bigint;
    COMMENT ON COLUMN files.original_size IS 'Original uploaded file size in bytes';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'files' AND column_name = 'optimized_size'
  ) THEN
    ALTER TABLE files ADD COLUMN optimized_size bigint;
    COMMENT ON COLUMN files.optimized_size IS 'Optimized file size in bytes';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_files_sizes ON files(optimized_size, original_size);
