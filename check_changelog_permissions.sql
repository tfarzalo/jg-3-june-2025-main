-- Check RLS policies on changelog table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'changelog'
ORDER BY policyname;

-- Check if RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'changelog';

-- If RLS is enabled but no policies exist, create a basic read policy
DO $$
BEGIN
  -- Check if policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'changelog' 
    AND policyname = 'changelog_read_published'
  ) THEN
    -- Create policy to allow everyone to read published entries
    EXECUTE 'CREATE POLICY changelog_read_published ON changelog FOR SELECT USING (is_published = true)';
    RAISE NOTICE 'Created read policy for changelog';
  ELSE
    RAISE NOTICE 'Read policy already exists';
  END IF;
END $$;

-- Test if we can read from changelog as an authenticated user
SELECT 
  'Can read changelog' as status,
  COUNT(*) as entry_count
FROM changelog
WHERE is_published = true;

-- Test if changelog_view works
SELECT 
  'Can read changelog_view' as status,
  COUNT(*) as entry_count
FROM changelog_view;
