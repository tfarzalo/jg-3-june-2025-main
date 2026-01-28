-- Check if the daily_summary_log table was updated in the last few minutes
SELECT 
  'Logs in last 10 minutes:' as check,
  COUNT(*) as count
FROM daily_summary_log 
WHERE sent_at > NOW() - INTERVAL '10 minutes';

-- Show all logs from today
SELECT 
  'All logs today:' as check,
  sent_at AT TIME ZONE 'America/New_York' as sent_at_et,
  recipient_count,
  success_count,
  failure_count,
  triggered_by,
  error_details
FROM daily_summary_log 
WHERE sent_at::date = CURRENT_DATE
ORDER BY sent_at DESC;

-- Show ALL logs ever (to see if table works at all)
SELECT 
  'All logs ever:' as check,
  sent_at AT TIME ZONE 'America/New_York' as sent_at_et,
  recipient_count,
  success_count,
  failure_count,
  triggered_by
FROM daily_summary_log 
ORDER BY sent_at DESC 
LIMIT 10;

-- Check table structure
SELECT 
  'Table structure:' as check,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'daily_summary_log'
ORDER BY ordinal_position;
