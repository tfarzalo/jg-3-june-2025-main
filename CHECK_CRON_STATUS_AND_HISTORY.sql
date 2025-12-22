-- =====================================================
-- CHECK DAILY AGENDA EMAIL CRON JOB STATUS
-- =====================================================
-- Run this in Supabase SQL Editor to check:
-- 1. If the cron job exists and is active
-- 2. Recent execution history
-- 3. Current schedule time
-- =====================================================

-- Check if pg_cron extension is enabled
SELECT EXISTS (
  SELECT 1 FROM pg_extension WHERE extname = 'cron'
) AS pg_cron_enabled;

-- Check current cron job configuration
SELECT 
  jobid,
  jobname, 
  schedule, 
  active,
  database,
  command
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job';

-- Check recent cron job execution history (last 10 runs)
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time AT TIME ZONE 'America/New_York' as start_time_et,
  end_time AT TIME ZONE 'America/New_York' as end_time_et
FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'daily-agenda-email-job')
ORDER BY start_time DESC 
LIMIT 10;

-- Check today's executions specifically
SELECT 
  jobid,
  runid,
  status,
  return_message,
  start_time AT TIME ZONE 'America/New_York' as start_time_et,
  end_time AT TIME ZONE 'America/New_York' as end_time_et
FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'daily-agenda-email-job')
  AND start_time >= CURRENT_DATE
ORDER BY start_time DESC;

-- Check who has daily email enabled
SELECT 
  p.id,
  p.full_name,
  p.email,
  p.role,
  des.enabled,
  des.created_at,
  des.updated_at
FROM profiles p
LEFT JOIN daily_email_settings des ON des.user_id = p.id
WHERE p.role IN ('admin', 'manager')
ORDER BY p.full_name;

-- Count enabled recipients
SELECT 
  COUNT(*) as total_enabled_recipients
FROM daily_email_settings
WHERE enabled = true;

-- =====================================================
-- INTERPRETATION GUIDE:
-- =====================================================
-- Schedule format: '0 12 * * *' means:
--   - 0: minute (0-59)
--   - 12: hour in UTC (0-23)
--   - * * *: day, month, day-of-week (all)
-- 
-- Current schedule '0 12 * * *' = 12:00 UTC
-- UTC to ET conversion:
--   - 12:00 UTC = 7:00 AM ET (during standard time)
--   - 12:00 UTC = 8:00 AM ET (during daylight saving)
-- 
-- Status values:
--   - 'succeeded': Job ran successfully
--   - 'failed': Job encountered an error
--   - 'running': Job is currently executing
-- =====================================================

-- =====================================================
-- NEXT STEPS IF NO RECENT RUNS:
-- =====================================================
-- 1. Check if the cron job is active (should be 'true')
-- 2. Check if today's date had a run (look at start_time_et)
-- 3. If no runs today, check Edge Function logs:
--    Supabase Dashboard → Edge Functions → send-daily-agenda-email → Logs
-- 4. Manually trigger test:
--    Run the test SQL in FIX_DAILY_AGENDA_CRON_JOB.sql (Step 6)
-- =====================================================
