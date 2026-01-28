-- Comprehensive Diagnostic Check

-- 1. Check if anyone has emails enabled
SELECT 
  '1. Email Recipients' as check,
  COUNT(*) as enabled_users
FROM daily_email_settings 
WHERE enabled = true;

-- Show who has emails enabled
SELECT 
  '1b. Users with emails enabled' as check,
  p.email,
  des.enabled,
  des.created_at
FROM daily_email_settings des
JOIN profiles p ON p.id = des.user_id
WHERE des.enabled = true;

-- 2. Check if the cron_config table is accessible
SELECT 
  '2. Cron Config' as check,
  key,
  CASE WHEN key = 'cron_secret' THEN '***REDACTED***' ELSE value END as value
FROM cron_config;

-- 3. Check current cron job
SELECT 
  '3. Active Cron Job' as check,
  jobid,
  jobname,
  schedule,
  active
FROM cron.job 
WHERE jobname LIKE '%daily-agenda%';

-- 4. Check if functions are deployed
SELECT 
  '4. Check Supabase Dashboard' as check,
  'Go to: https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh/functions' as url,
  'Verify both functions are deployed: daily-agenda-cron-trigger and send-daily-agenda-email' as action;

-- 5. Manual test - call the function directly
SELECT 
  '5. Testing function call now...' as check,
  net.http_post(
    url := (SELECT value FROM cron_config WHERE key = 'supabase_url') || '/functions/v1/daily-agenda-cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM cron_config WHERE key = 'cron_secret')
    ),
    body := jsonb_build_object(
      'triggered_by', 'diagnostic_test',
      'timestamp', now()
    )
  ) as http_response;

-- 6. Wait a moment, then check the log again
SELECT pg_sleep(3);

SELECT 
  '6. Check log after test' as check,
  COUNT(*) as log_entries
FROM daily_summary_log;

-- If still empty, show recent entries
SELECT 
  '6b. Recent log entries' as check,
  *
FROM daily_summary_log 
ORDER BY sent_at DESC 
LIMIT 5;
