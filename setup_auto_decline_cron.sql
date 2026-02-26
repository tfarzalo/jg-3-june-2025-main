-- =====================================================
-- Setup Cron Job for Auto-Decline
-- =====================================================
-- Run this FIFTH (after grant_assignment_permissions.sql)
-- Purpose: Set up hourly cron job to auto-decline expired assignments

-- NOTE: pg_cron should already be enabled in Supabase projects.
-- If you get an error, enable it manually in the Supabase Dashboard:
-- Database → Extensions → Enable pg_cron

-- Remove existing cron job if it exists (ignore error if doesn't exist)
DO $$
BEGIN
  PERFORM cron.unschedule('auto-decline-expired-assignments');
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Job doesn't exist, continue
END $$;

-- Schedule the auto-decline function to run every hour
-- Runs at the top of every hour (0 minutes past)
SELECT cron.schedule(
  'auto-decline-expired-assignments',
  '0 * * * *', -- Cron expression: every hour at :00
  $$
  SELECT net.http_post(
    url := 'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/auto-decline-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Verify the cron job was created
SELECT 
  jobid,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'auto-decline-expired-assignments';

-- Success message
SELECT 'Auto-decline cron job scheduled to run every hour!' as status;
