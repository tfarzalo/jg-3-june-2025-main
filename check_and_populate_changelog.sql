-- Check if changelog table has data
SELECT COUNT(*) as total_entries FROM changelog;

-- Check if changelog_view exists and has data
SELECT COUNT(*) as total_entries FROM changelog_view;

-- Check the structure of the changelog table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'changelog'
ORDER BY ordinal_position;

-- Check if changelog_view exists
SELECT table_name, view_definition
FROM information_schema.views
WHERE table_name = 'changelog_view';

-- If no data exists, insert some sample changelog entries
-- (Run this only if the table is empty)
DO $$
BEGIN
  -- Check if table is empty
  IF NOT EXISTS (SELECT 1 FROM changelog LIMIT 1) THEN
    -- Insert sample entries
    INSERT INTO changelog (
      title,
      description,
      category,
      priority,
      version,
      author_name,
      author_email,
      is_breaking_change,
      is_published,
      published_at
    ) VALUES
    (
      'Job Phase Advancement Fixed',
      'Fixed issue where job phase changes required page refresh. Changes now reflect immediately in the UI with proper loading states.',
      'fix',
      'high',
      '1.2.0',
      'System',
      'support@jgpaintingprosinc.com',
      false,
      true,
      NOW()
    ),
    (
      'Activity Logging System',
      'Implemented comprehensive activity logging for all major operations including job creation, phase changes, property updates, and more.',
      'feature',
      'high',
      '1.2.0',
      'System',
      'support@jgpaintingprosinc.com',
      false,
      true,
      NOW()
    ),
    (
      'Support Form Auto-Population',
      'Support ticket form now automatically fills in user name and email from their profile.',
      'enhancement',
      'medium',
      '1.2.0',
      'System',
      'support@jgpaintingprosinc.com',
      false,
      true,
      NOW()
    ),
    (
      'Notification System Enhanced',
      'Added color-coded notifications with real-time updates and persistent read state.',
      'feature',
      'high',
      '1.1.0',
      'System',
      'support@jgpaintingprosinc.com',
      false,
      true,
      NOW() - INTERVAL '1 day'
    ),
    (
      'Job Creation Error Fixed',
      'Resolved critical issue preventing new job requests from being created. Added defensive error handling to database triggers.',
      'fix',
      'critical',
      '1.2.1',
      'System',
      'support@jgpaintingprosinc.com',
      false,
      true,
      NOW()
    );

    RAISE NOTICE 'Sample changelog entries inserted successfully';
  ELSE
    RAISE NOTICE 'Changelog table already has data';
  END IF;
END $$;

-- Verify the data was inserted
SELECT 
  id,
  title,
  category,
  priority,
  is_published,
  created_at
FROM changelog
ORDER BY created_at DESC
LIMIT 10;
