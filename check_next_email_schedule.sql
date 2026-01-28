-- Check when the next daily agenda email should be sent
-- Run this in Supabase SQL Editor

-- 1. Check current timezone and time
SELECT 
  NOW() AS "Current UTC Time",
  NOW() AT TIME ZONE 'America/New_York' AS "Current EST Time",
  CURRENT_DATE AS "Current UTC Date",
  (NOW() AT TIME ZONE 'America/New_York')::date AS "Current EST Date";

-- 2. Check email schedule configuration
SELECT 
  key,
  value,
  description
FROM app_settings
WHERE key LIKE '%email%'
ORDER BY key;

-- 3. Check cron job configuration
SELECT 
  jobid,
  schedule,
  command,
  active,
  jobname
FROM cron.job
WHERE jobname LIKE '%daily%' OR jobname LIKE '%agenda%';

-- 4. Calculate next scheduled run time
WITH schedule_info AS (
  SELECT 
    value::jsonb->>'hour' AS configured_hour,
    value::jsonb->>'timezone' AS configured_timezone
  FROM app_settings
  WHERE key = 'daily_agenda_email_schedule'
),
current_time_info AS (
  SELECT
    NOW() AS current_utc,
    NOW() AT TIME ZONE 'America/New_York' AS current_est,
    (NOW() AT TIME ZONE 'America/New_York')::time AS current_est_time,
    (NOW() AT TIME ZONE 'America/New_York')::date AS current_est_date
)
SELECT
  si.configured_hour || ':00 ' || si.configured_timezone AS "Configured Schedule",
  cti.current_est AS "Current EST Time",
  cti.current_est_time AS "Current EST Time (Time Only)",
  CASE 
    WHEN cti.current_est_time < (si.configured_hour || ':00:00')::time 
    THEN 'Today at ' || si.configured_hour || ':00 EST'
    ELSE 'Tomorrow at ' || si.configured_hour || ':00 EST'
  END AS "Next Email Time (EST)",
  CASE 
    WHEN cti.current_est_time < (si.configured_hour || ':00:00')::time 
    THEN (cti.current_est_date || ' ' || si.configured_hour || ':00:00')::timestamp AT TIME ZONE 'America/New_York'
    ELSE ((cti.current_est_date + INTERVAL '1 day') || ' ' || si.configured_hour || ':00:00')::timestamp AT TIME ZONE 'America/New_York'
  END AS "Next Email Time (UTC)"
FROM schedule_info si, current_time_info cti;

-- 5. Check last email send attempt
SELECT 
  created_at,
  status,
  recipient_count,
  error_message
FROM email_send_log
WHERE email_type = 'daily_agenda'
ORDER BY created_at DESC
LIMIT 5;

-- 6. Check jobs scheduled for today (EST)
WITH today_est AS (
  SELECT (NOW() AT TIME ZONE 'America/New_York')::date AS today
)
SELECT 
  COUNT(*) AS "Jobs Scheduled for Today (EST)",
  COUNT(*) FILTER (WHERE status IN ('Open', 'Scheduled', 'Pending')) AS "Open Jobs",
  COUNT(*) FILTER (WHERE assigned_to IS NOT NULL) AS "Assigned Jobs",
  COUNT(*) FILTER (WHERE assigned_to IS NULL) AS "Unassigned Jobs"
FROM jobs, today_est
WHERE scheduled_date = today_est.today;
