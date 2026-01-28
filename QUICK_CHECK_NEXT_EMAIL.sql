-- =====================================================
-- QUICK CHECK: When is the next daily agenda email?
-- =====================================================
-- Copy this entire script and run in Supabase SQL Editor

\echo '=== 🕐 Current Time ==='
SELECT 
  NOW() AT TIME ZONE 'America/New_York' AS "Current Time (EST)",
  NOW() AS "Current Time (UTC)";

\echo ''
\echo '=== ⚙️  Email Schedule Configuration ==='
SELECT 
  value->>'hour' AS "Configured Hour (EST)",
  value->>'timezone' AS "Timezone",
  CONCAT(value->>'hour', ':00 ', value->>'timezone') AS "Full Schedule"
FROM app_settings
WHERE key = 'daily_agenda_email_schedule';

\echo ''
\echo '=== 🤖 Cron Job Status ==='
SELECT 
  CASE 
    WHEN schedule = '0 12 * * *' THEN '✅ Correct (7:00 AM EST)'
    ELSE '⚠️  Check schedule: ' || schedule
  END AS "Cron Status",
  schedule AS "Cron Expression",
  CASE WHEN active THEN '✅ Active' ELSE '❌ Inactive' END AS "Job Active",
  jobname AS "Job Name"
FROM cron.job
WHERE jobname LIKE '%daily%' OR jobname LIKE '%agenda%';

\echo ''
\echo '=== ⏰ Next Email Send Time ==='
WITH config AS (
  SELECT 
    (value->>'hour')::int AS hour_est,
    value->>'timezone' AS tz
  FROM app_settings
  WHERE key = 'daily_agenda_email_schedule'
),
now_est AS (
  SELECT 
    NOW() AT TIME ZONE 'America/New_York' AS current_time,
    (NOW() AT TIME ZONE 'America/New_York')::date AS current_date,
    (NOW() AT TIME ZONE 'America/New_York')::time AS current_time_only
),
next_run AS (
  SELECT
    config.hour_est,
    now_est.current_time,
    now_est.current_date,
    now_est.current_time_only,
    CASE 
      WHEN now_est.current_time_only < (config.hour_est || ':00:00')::time 
      THEN now_est.current_date
      ELSE now_est.current_date + INTERVAL '1 day'
    END AS next_date,
    CASE 
      WHEN now_est.current_time_only < (config.hour_est || ':00:00')::time 
      THEN 'Today'
      ELSE 'Tomorrow'
    END AS when_text
  FROM config, now_est
)
SELECT
  when_text AS "When",
  TO_CHAR(next_date, 'Day, Mon DD, YYYY') AS "Date",
  hour_est || ':00 AM EST' AS "Time (EST)",
  (next_date + (hour_est || ' hours')::interval) AT TIME ZONE 'America/New_York' AT TIME ZONE 'UTC' AS "Time (UTC)",
  CASE 
    WHEN when_text = 'Today' THEN
      '⏰ Email will be sent later today at ' || hour_est || ':00 AM EST'
    ELSE
      '📅 Email will be sent tomorrow at ' || hour_est || ':00 AM EST'
  END AS "Status Message"
FROM next_run;

\echo ''
\echo '=== 📧 Last 3 Email Sends ==='
SELECT 
  created_at AT TIME ZONE 'America/New_York' AS "Sent At (EST)",
  CASE 
    WHEN status = 'success' THEN '✅ Success'
    WHEN status = 'error' THEN '❌ Error'
    ELSE '⚠️  ' || status
  END AS "Status",
  recipient_count AS "Recipients",
  CASE 
    WHEN error_message IS NOT NULL THEN LEFT(error_message, 50)
    ELSE '—'
  END AS "Error (if any)"
FROM email_send_log
WHERE email_type = 'daily_agenda'
ORDER BY created_at DESC
LIMIT 3;

\echo ''
\echo '=== 📋 Today\'s Jobs (EST) ==='
WITH today_est AS (
  SELECT (NOW() AT TIME ZONE 'America/New_York')::date AS today
)
SELECT 
  COUNT(*) AS "Total Jobs Scheduled Today",
  COUNT(*) FILTER (WHERE status IN ('Open', 'Scheduled', 'Pending')) AS "Open Jobs",
  COUNT(*) FILTER (WHERE assigned_to IS NOT NULL) AS "Assigned",
  COUNT(*) FILTER (WHERE assigned_to IS NULL) AS "Unassigned"
FROM jobs, today_est
WHERE scheduled_date = today_est.today;

\echo ''
\echo '=== ✅ Summary ==='
\echo 'If cron shows "0 12 * * *" and is Active, emails will send at 7:00 AM EST daily.'
\echo 'Check "Next Email Send Time" above to see exactly when the next email will go out.'
\echo ''
