-- Check Email Trigger Results
-- Run this to see if the email was sent successfully

-- Most Recent Email Sends
SELECT 
  'Recent Email Sends' as check_type,
  sent_at AT TIME ZONE 'America/New_York' as sent_at_et,
  recipient_count,
  success_count,
  failure_count,
  triggered_by,
  CASE 
    WHEN failure_count = 0 THEN '✓ All successful'
    WHEN success_count > 0 THEN 'Partial success'
    ELSE '✗ All failed'
  END as status,
  error_details
FROM daily_summary_log 
ORDER BY sent_at DESC 
LIMIT 5;

-- Users with Email Enabled
SELECT 
  'Users with Email Enabled' as check_type,
  COUNT(*) as enabled_count
FROM daily_email_settings 
WHERE enabled = true;

SELECT 
  des.user_id,
  p.email,
  des.enabled
FROM daily_email_settings des
JOIN profiles p ON p.id = des.user_id
WHERE des.enabled = true
ORDER BY p.email;

-- Cron Job Status
SELECT 
  'Cron Jobs' as check_type,
  jobid,
  jobname,
  schedule,
  active
FROM cron.job 
WHERE jobname LIKE '%daily-agenda%';

-- Recent Cron Executions
SELECT 
  'Recent Cron Executions' as check_type,
  start_time AT TIME ZONE 'America/New_York' as execution_time_et,
  status,
  SUBSTRING(return_message, 1, 200) as result
FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE '%daily-agenda%')
ORDER BY start_time DESC 
LIMIT 5;
