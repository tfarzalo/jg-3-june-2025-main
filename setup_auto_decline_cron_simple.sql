-- =====================================================
-- Setup Cron Job for Auto-Decline (SIMPLE VERSION)
-- =====================================================
-- This version calls the database function directly (no Edge Function)
-- Recommended if you have issues with pg_cron setup

-- PREREQUISITE: Enable pg_cron extension via Supabase Dashboard
-- Dashboard → Database → Extensions → Enable pg_cron

-- Remove existing cron job if it exists (ignore error if doesn't exist)
DO $$
BEGIN
  PERFORM cron.unschedule('auto-decline-expired-assignments');
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Job doesn't exist, continue
END $$;

-- Schedule the auto-decline function to run every hour
-- This directly calls the database function (simpler, more reliable)
SELECT cron.schedule(
  'auto-decline-expired-assignments',
  '0 * * * *', -- Run at the top of every hour
  'SELECT auto_decline_expired_assignments();'
);

-- Verify the cron job was created
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'auto-decline-expired-assignments';

-- Success message
SELECT 'Auto-decline cron job scheduled successfully! Runs every hour at :00' as status;
