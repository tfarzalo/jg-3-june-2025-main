-- Test if we can manually insert into daily_summary_log
-- This will tell us if RLS is blocking the function

-- First, check RLS status
SELECT 
  'RLS Status:' as check,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'daily_summary_log';

-- Check RLS policies
SELECT 
  'RLS Policies:' as check,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'daily_summary_log';

-- Try to insert a test record (this will fail if RLS blocks us)
INSERT INTO daily_summary_log (
  recipient_count,
  success_count,
  failure_count,
  triggered_by,
  error_details
) VALUES (
  4,
  4,
  0,
  'manual_test_insert',
  NULL
);

-- Check if it was inserted
SELECT 
  'After manual insert:' as check,
  COUNT(*) as total
FROM daily_summary_log;

-- Show the record
SELECT * FROM daily_summary_log ORDER BY sent_at DESC LIMIT 1;
