-- =====================================================
-- Schedule Daily Agenda Email at 5:00 AM ET (Weekdays)
-- =====================================================
-- Prerequisites:
-- - pg_cron extension enabled (Database → Extensions → cron)
-- - http extension enabled
-- - app.settings.service_role_key set (Database → Settings → Parameters)
--   Use: SELECT set_config('app.settings.service_role_key', '<SERVICE_ROLE_KEY>', false);
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS cron;
CREATE EXTENSION IF NOT EXISTS http;

-- Safely remove existing job if present
DO $$
BEGIN
  PERFORM cron.unschedule('daily-agenda-email-job');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- Schedule job at 10:00 UTC Monday–Friday (5:00 AM ET in Standard Time)
-- Note: During Daylight Saving Time this runs at 6:00 AM ET
SELECT cron.schedule(
  'daily-agenda-email-job',
  '0 10 * * 1-5',
  $$
  SELECT 
    content::json->>'message' as result
  FROM 
    http((
      'POST',
      current_setting('app.settings.project_url', true) || '/functions/v1/send-daily-agenda-email',
      ARRAY[
        http_header('Content-Type', 'application/json'),
        http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true))
      ],
      'application/json',
      '{"mode":"all","test":false}'
    )::http_request);
  $$
);

-- Verify job exists and is active
SELECT 
  jobid,
  jobname, 
  schedule, 
  active
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job';

-- Show recent runs (ET)
SELECT 
  jobid,
  runid,
  status,
  return_message,
  start_time AT TIME ZONE 'America/New_York' AS start_time_et,
  end_time AT TIME ZONE 'America/New_York' AS end_time_et
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'daily-agenda-email-job')
ORDER BY start_time DESC
LIMIT 10;

