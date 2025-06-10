-- Log the number of files/folders before deletion
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM files;
  RAISE NOTICE 'Deleting % files/folders from files table', v_count;
END $$;

-- Delete all files and folders
DELETE FROM files;

-- Optionally, reset the primary key sequence (uncomment if needed)
-- ALTER SEQUENCE files_id_seq RESTART WITH 1; 