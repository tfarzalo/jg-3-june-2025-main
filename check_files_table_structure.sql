-- Quick check: What columns exist in the files table?
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'files' 
ORDER BY ordinal_position;
