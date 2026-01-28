-- =====================================================
-- DIAGNOSE DAILY AGENDA EMAIL SCHEDULE ISSUE
-- =====================================================
-- Run this to understand why emails are sending at 1am ET instead of the configured time

-- 1. Check current configuration in daily_email_config table
SELECT 
  'Config Settings' as section,
  send_time_utc,
  send_time_timezone,
  send_time_utc::text as "Time (stored in DB)",
  (send_time_utc AT TIME ZONE 'UTC' AT TIME ZONE send_time_timezone)::time as "Time in ET",
  updated_at,
  updated_by
FROM daily_email_config;

-- 2. Check current cron job schedule
SELECT 
  'Cron Job Details' as section,
  jobid,
  jobname,
  schedule as "Cron Expression",
  active
FROM cron.job 
WHERE jobname LIKE '%daily%agenda%' OR jobname LIKE '%daily%email%'
ORDER BY jobname;

-- 3. Show what the cron expression means
-- Example: '0 12 * * *' means minute=0, hour=12 (UTC), every day
-- 12:00 UTC = 7:00 AM EST (Standard Time) or 8:00 AM EDT (Daylight Time)
-- 05:00 UTC = 12:00 AM (midnight) EST or 1:00 AM EDT
-- 06:00 UTC = 1:00 AM EST or 2:00 AM EDT

SELECT 
  'Timezone Info' as section,
  NOW() AT TIME ZONE 'UTC' as "Current UTC Time",
  NOW() AT TIME ZONE 'America/New_York' as "Current ET Time",
  EXTRACT(TIMEZONE_HOUR FROM NOW() AT TIME ZONE 'America/New_York') as "ET UTC Offset (hours)";

-- 4. Recent job executions
SELECT 
  'Recent Runs' as section,
  jr.jobid,
  j.jobname,
  jr.status,
  jr.start_time AT TIME ZONE 'UTC' as "Run Time (UTC)",
  jr.start_time AT TIME ZONE 'America/New_York' as "Run Time (ET)",
  jr.return_message,
  jr.end_time
FROM cron.job_run_details jr
JOIN cron.job j ON j.jobid = jr.jobid
WHERE j.jobname LIKE '%daily%agenda%' OR j.jobname LIKE '%daily%email%'
ORDER BY jr.start_time DESC
LIMIT 10;

-- 5. Expected vs Actual Times
-- If you're getting emails at 1am ET, let's figure out what UTC time that is
SELECT 
  'Time Conversion Analysis' as section,
  '1:00 AM ET is 05:00 UTC (EST) or 06:00 UTC (EDT)' as explanation,
  'If cron is set to hour=5 or 6, that explains the 1am delivery' as diagnosis;

-- 6. Check if trigger function exists and is correct
SELECT 
  'Trigger Function' as section,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
WHERE p.proname = 'update_daily_email_cron_schedule';
