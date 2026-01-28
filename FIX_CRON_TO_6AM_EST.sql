-- =====================================================
-- QUICK FIX: Set Daily Agenda Email to 6 AM EST
-- =====================================================
-- This will manually update the cron job to send at 6 AM EST
-- 6:00 AM EST = 11:00 AM UTC (during standard time)

\echo '=== 🔧 Fixing Daily Agenda Email Schedule ==='
\echo 'Setting email to send at 6:00 AM EST (11:00 UTC)...'
\echo ''

-- First, unschedule the old job (if it exists)
DO $$
BEGIN
  -- Try to unschedule if the job exists
  PERFORM cron.unschedule('send-daily-agenda-email');
  RAISE NOTICE '✅ Old cron job removed';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '⚠️  No existing job to remove (this is OK)';
END $$;

\echo ''
\echo 'Creating new cron job for 6:00 AM EST...'
\echo ''

-- Schedule new job at 6 AM EST (11:00 UTC)
-- NOTE: Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY with actual values
SELECT cron.schedule(
  'send-daily-agenda-email',
  '0 11 * * *',  -- Run at 11:00 UTC = 6:00 AM EST
  $$
  SELECT
    net.http_post(
        url := 'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRid3RmaW1uYm12Ymdlc2lkYnhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxOTI1NDc3OSwiZXhwIjoyMDM0ODMwNzc5fQ.Ct9Z5D4oRvkUoEHWFmRR1lYUQE2gPvMHBxhfN40KSlU"}'::jsonb,
        body := '{}'::jsonb
    ) as request_id;
  $$
);

\echo ''
\echo '=== ✅ Verification ==='
\echo 'Checking new cron job...'
\echo ''

-- Verify the cron job
SELECT 
  jobname AS "Job Name",
  schedule AS "Cron Expression",
  CASE schedule
    WHEN '0 11 * * *' THEN '✅ CORRECT (6:00 AM EST)'
    WHEN '0 12 * * *' THEN '❌ WRONG (7:00 AM EST)'
    ELSE '⚠️  UNEXPECTED: ' || schedule
  END AS "Status",
  active AS "Active"
FROM cron.job
WHERE jobname = 'send-daily-agenda-email';

\echo ''
\echo '=== 🕐 When is the next email? ==='
\echo ''

-- Calculate next send time
WITH now_info AS (
  SELECT 
    NOW() AT TIME ZONE 'America/New_York' AS current_est,
    (NOW() AT TIME ZONE 'America/New_York')::time AS current_time
),
next_send AS (
  SELECT
    CASE 
      WHEN (SELECT current_time FROM now_info) < '06:00:00'::time 
      THEN 'Today'
      ELSE 'Tomorrow'
    END AS when_text,
    CASE 
      WHEN (SELECT current_time FROM now_info) < '06:00:00'::time 
      THEN (SELECT current_est FROM now_info)::date
      ELSE (SELECT current_est FROM now_info)::date + INTERVAL '1 day'
    END AS next_date
)
SELECT
  (SELECT current_est FROM now_info) AS "Current Time (EST)",
  when_text || ' at 6:00 AM EST' AS "Next Email",
  (next_date + INTERVAL '6 hours') AS "Next Send Time (EST)",
  (next_date + INTERVAL '6 hours') AT TIME ZONE 'America/New_York' AT TIME ZONE 'UTC' AS "Next Send Time (UTC)"
FROM next_send;

\echo ''
\echo '=== 📋 Update Frontend Setting (Optional) ==='
\echo 'If you want the frontend to also show 6:00 AM:'
\echo ''
\echo '-- Option 1: Update daily_email_config (if using this table)'
\echo 'UPDATE daily_email_config'
\echo 'SET send_time_utc = ''06:00:00'','
\echo '    send_time_timezone = ''America/New_York'','
\echo '    updated_at = NOW();'
\echo ''
\echo '-- Option 2: Update app_settings (if using this approach)'
\echo 'INSERT INTO app_settings (key, value, description)'
\echo 'VALUES ('
\echo '  ''daily_agenda_email_schedule'','
\echo '  ''{"hour": "6", "timezone": "America/New_York"}'','
\echo '  ''Daily agenda email schedule configuration'''
\echo ')'
\echo 'ON CONFLICT (key) DO UPDATE'
\echo 'SET value = EXCLUDED.value;'
\echo ''

\echo '=== ✅ Done! ==='
\echo ''
\echo 'Daily agenda emails will now be sent at 6:00 AM EST (11:00 UTC).'
\echo ''
\echo 'Note: If you change the time in the frontend admin settings again,'
\echo 'you may need to run this fix script again (or fix the trigger system).'
\echo ''
