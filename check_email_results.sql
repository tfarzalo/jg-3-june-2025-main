-- Check Email Trigger Results
-- Run this to see if the email was sent successfully

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📊 Most Recent Email Sends'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  sent_at AT TIME ZONE 'America/New_York' as sent_at_et,
  success,
  recipient_count,
  triggered_by,
  CASE 
    WHEN error_message IS NULL THEN '✓ No errors'
    ELSE error_message 
  END as status
FROM daily_summary_log 
ORDER BY sent_at DESC 
LIMIT 5;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '👥 Users with Email Enabled'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  id,
  email,
  daily_email_enabled,
  created_at::date as joined
FROM profiles 
WHERE daily_email_enabled = true
ORDER BY email;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '⏰ Cron Job Status'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE active
    WHEN true THEN '✓ Active'
    ELSE '✗ Inactive'
  END as status
FROM cron.job 
WHERE jobname LIKE '%daily-agenda%';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🔍 Recent Cron Executions'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT 
  start_time AT TIME ZONE 'America/New_York' as execution_time_et,
  status,
  SUBSTRING(return_message, 1, 100) as result
FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE '%daily-agenda%')
ORDER BY start_time DESC 
LIMIT 5;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
