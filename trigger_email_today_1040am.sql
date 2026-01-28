-- One-Time Trigger for Daily Agenda Email
-- Scheduled for: Today, January 23, 2026 at 10:40 AM ET (15:40 UTC)
-- This will run once and then be automatically removed

-- Create a one-time scheduled job
SELECT cron.schedule(
  'daily-agenda-email-test-once',           -- Unique job name
  '40 15 23 1 *',                          -- At 15:40 UTC on January 23 (10:40 AM ET)
  $$
  SELECT
    net.http_post(
      url := (SELECT value FROM cron_config WHERE key = 'supabase_url') || '/functions/v1/daily-agenda-cron-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM cron_config WHERE key = 'cron_secret')
      ),
      body := jsonb_build_object(
        'triggered_by', 'one_time_test',
        'timestamp', now()
      )
    ) as request_id;
  $$
);

-- Verify the job is scheduled
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobname = 'daily-agenda-email-test-once';

-- After the job runs at 10:40 AM ET, you can remove it with:
-- SELECT cron.unschedule('daily-agenda-email-test-once');

-- Expected output:
-- The job will appear in the list with schedule '40 15 23 1 *'
-- At 10:40 AM ET today, it will trigger the email send
-- Check the results with: SELECT * FROM daily_summary_log ORDER BY sent_at DESC LIMIT 1;
