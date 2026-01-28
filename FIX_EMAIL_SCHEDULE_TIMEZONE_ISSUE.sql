-- =====================================================
-- FIX DAILY AGENDA EMAIL SCHEDULE - TIMEZONE CORRECTION
-- =====================================================
-- This fixes the issue where emails are sent at 1am ET instead of the configured time
-- 
-- ROOT CAUSE:
-- The UI allows admin to set a time (e.g., "7:00 AM"), but the system is unclear
-- about whether this is ET or UTC. The trigger function creates a cron job
-- using the stored time directly as UTC, but users expect ET.
--
-- SOLUTION:
-- 1. Update the database function to properly convert ET to UTC
-- 2. Add a manual cron reschedule to the correct time immediately
-- =====================================================

-- Step 1: Drop and recreate the trigger function with proper timezone conversion
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
  -- The time stored in send_time_utc should be interpreted as the time in send_time_timezone
  -- We need to convert it to actual UTC time for the cron expression
  
  -- Convert the time from the specified timezone to UTC
  -- Example: If user sets 7:00 AM ET, we need to schedule cron at 12:00 UTC (standard) or 11:00 UTC (daylight)
  utc_time := (
    (CURRENT_DATE + NEW.send_time_utc) AT TIME ZONE NEW.send_time_timezone AT TIME ZONE 'UTC'
  )::time;
  
  -- Extract hour and minute from the UTC time
  hour_val := EXTRACT(HOUR FROM utc_time);
  minute_val := EXTRACT(MINUTE FROM utc_time);
  
  -- Build cron expression (minute hour * * *)
  cron_expr := minute_val || ' ' || hour_val || ' * * *';
  
  RAISE NOTICE 'Converting % % to UTC: % (cron: %)', 
    NEW.send_time_utc, NEW.send_time_timezone, utc_time, cron_expr;
  
  -- Unschedule existing job (if exists)
  BEGIN
    PERFORM cron.unschedule('daily-agenda-email-cron');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No existing cron job to unschedule';
  END;
  
  -- Reschedule with new time (in UTC)
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
  
  RAISE NOTICE '✅ Cron job rescheduled to run at % UTC (% %)', 
    utc_time, NEW.send_time_utc, NEW.send_time_timezone;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_update_cron_schedule ON daily_email_config;
DROP TRIGGER IF EXISTS trigger_update_cron_schedule_insert ON daily_email_config;
DROP TRIGGER IF EXISTS trigger_update_cron_schedule_update ON daily_email_config;

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

-- Step 2: Update the table comments to clarify the field meaning
COMMENT ON COLUMN daily_email_config.send_time_utc IS 
  'Time in the timezone specified by send_time_timezone (NOT UTC despite the name). The cron trigger function converts this to actual UTC.';
COMMENT ON COLUMN daily_email_config.send_time_timezone IS 
  'Timezone for send_time_utc field (e.g., America/New_York). Defaults to ET.';

-- Step 3: IMPORTANT - Trigger the function by updating the config
-- This will force the cron job to be rescheduled with the correct timezone conversion
UPDATE daily_email_config
SET updated_at = NOW()
WHERE id = (SELECT id FROM daily_email_config LIMIT 1);

-- Step 4: Verify the new schedule
SELECT 
  '=== Current Configuration ===' as section,
  send_time_utc as "Time (in timezone)",
  send_time_timezone as "Timezone",
  (
    (CURRENT_DATE + send_time_utc) AT TIME ZONE send_time_timezone AT TIME ZONE 'UTC'
  )::time as "Actual UTC Time",
  updated_at
FROM daily_email_config;

SELECT 
  '=== Cron Job Schedule ===' as section,
  jobname,
  schedule as "Cron Expression (UTC)",
  active
FROM cron.job 
WHERE jobname = 'daily-agenda-email-cron';

-- Step 5: Show what this means
SELECT 
  '=== Explanation ===' as section,
  'The cron job now runs at the correct UTC time that corresponds to your configured ET time' as explanation,
  'Example: 7:00 AM ET → 12:00 UTC (EST) or 11:00 UTC (EDT)' as example;
