-- =====================================================
-- FIX DAILY AGENDA EMAIL SCHEDULE & DIAGNOSTICS
-- =====================================================

-- 1. Reschedule Cron Job to 5:00 AM EST (10:00 UTC)
-- This block preserves your existing command (and API keys)
DO $$
DECLARE
  v_command text;
BEGIN
  -- Get existing command from the current job
  SELECT command INTO v_command FROM cron.job WHERE jobname = 'daily-agenda-email-job';
  
  IF v_command IS NULL THEN
    RAISE NOTICE 'Job not found. Please run the full setup script (FIX_DAILY_AGENDA_CRON_JOB.sql) first.';
  ELSE
    -- Unschedule the old job
    PERFORM cron.unschedule('daily-agenda-email-job');

    -- Schedule the new job at 10:00 UTC
    -- 10:00 UTC = 5:00 AM EST (Standard Time)
    -- 10:00 UTC = 6:00 AM EDT (Daylight Saving Time)
    PERFORM cron.schedule('daily-agenda-email-job', '0 10 * * *', v_command);
    
    RAISE NOTICE '✅ Job successfully rescheduled to 10:00 UTC (5:00 AM EST)';
  END IF;
END $$;

-- 2. Verify the new schedule
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job';

-- 3. Check for Enabled Recipients
-- If this returns 0 rows, NO EMAILS WILL BE SENT.
SELECT 
  p.full_name,
  p.email,
  des.enabled,
  des.updated_at
FROM daily_email_settings des
JOIN profiles p ON p.id = des.user_id
WHERE des.enabled = true;

-- 4. Check Recent Executions
SELECT 
  jobid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'daily-agenda-email-job')
ORDER BY start_time DESC
LIMIT 5;
