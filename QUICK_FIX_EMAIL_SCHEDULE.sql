-- =====================================================
-- QUICK FIX: Daily Agenda Email Schedule (1-Minute Fix)
-- =====================================================
-- Run this in Supabase SQL Editor to immediately fix the timezone issue
-- This is the simplified version - see EMAIL_SCHEDULE_TIMEZONE_FIX_GUIDE.md for details
-- =====================================================

-- Step 1: Fix the trigger function to properly convert ET to UTC
DROP FUNCTION IF EXISTS update_daily_email_cron_schedule() CASCADE;

CREATE OR REPLACE FUNCTION update_daily_email_cron_schedule()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  hour_val INTEGER;
  minute_val INTEGER;
  cron_expr TEXT;
  utc_time TIME;
BEGIN
  -- Convert ET time to actual UTC time
  utc_time := (
    (CURRENT_DATE + NEW.send_time_utc) AT TIME ZONE NEW.send_time_timezone AT TIME ZONE 'UTC'
  )::time;
  
  hour_val := EXTRACT(HOUR FROM utc_time);
  minute_val := EXTRACT(MINUTE FROM utc_time);
  cron_expr := minute_val || ' ' || hour_val || ' * * *';
  
  -- Unschedule existing job
  BEGIN
    PERFORM cron.unschedule('daily-agenda-email-cron');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Reschedule with correct UTC time
  PERFORM cron.schedule(
    'daily-agenda-email-cron',
    cron_expr,
    $cmd$
    SELECT
      net.http_post(
        url := (SELECT value FROM cron_config WHERE key = 'supabase_url') || '/functions/v1/send-daily-agenda-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT value FROM cron_config WHERE key = 'service_role_key')
        ),
        body := jsonb_build_object(
          'triggered_by', 'pg_cron',
          'timestamp', now()
        )
      ) as request_id;
    $cmd$
  );
  
  RAISE NOTICE '✅ Cron rescheduled: % % → % UTC (cron: %)', 
    NEW.send_time_utc, NEW.send_time_timezone, utc_time, cron_expr;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Recreate the trigger
-- Drop old trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_cron_schedule ON daily_email_config;

-- Separate triggers for INSERT and UPDATE to avoid OLD reference issues
CREATE TRIGGER trigger_update_cron_schedule_insert
  AFTER INSERT ON daily_email_config
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_email_cron_schedule();

CREATE TRIGGER trigger_update_cron_schedule_update
  AFTER UPDATE ON daily_email_config
  FOR EACH ROW
  WHEN (
    NEW.send_time_utc IS DISTINCT FROM OLD.send_time_utc OR
    NEW.send_time_timezone IS DISTINCT FROM OLD.send_time_timezone
  )
  EXECUTE FUNCTION update_daily_email_cron_schedule();

-- Step 3: Force reschedule with correct timezone conversion
UPDATE daily_email_config SET updated_at = NOW();

-- Step 4: Verify the fix
SELECT 
  send_time_utc as "Set Time (ET)",
  (
    (CURRENT_DATE + send_time_utc) AT TIME ZONE send_time_timezone AT TIME ZONE 'UTC'
  )::time as "Actual UTC Time",
  send_time_timezone as "Timezone"
FROM daily_email_config;

SELECT 
  jobname,
  schedule as "Cron Expression (UTC)",
  active
FROM cron.job 
WHERE jobname = 'daily-agenda-email-cron';

-- Done! The cron job is now scheduled at the correct UTC time.
-- Emails will be sent at the configured ET time.
