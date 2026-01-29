-- Fix daily agenda email schedule to always interpret admin time as Eastern Time
-- Created: 2026-01-28

-- Update the trigger function to convert ET -> UTC before scheduling cron
DROP FUNCTION IF EXISTS update_daily_email_cron_schedule() CASCADE;

CREATE OR REPLACE FUNCTION update_daily_email_cron_schedule()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, cron
AS $func$
DECLARE
  hour_val INTEGER;
  minute_val INTEGER;
  cron_expr TEXT;
  utc_time TIME;
  timezone_val TEXT;
BEGIN
  -- Always interpret configured time as Eastern Time (ET)
  timezone_val := 'America/New_York';

  utc_time := (
    (CURRENT_DATE + NEW.send_time_utc) AT TIME ZONE timezone_val AT TIME ZONE 'UTC'
  )::time;
  
  hour_val := EXTRACT(HOUR FROM utc_time);
  minute_val := EXTRACT(MINUTE FROM utc_time);
  cron_expr := minute_val || ' ' || hour_val || ' * * *';
  
  BEGIN
    PERFORM cron.unschedule('daily-agenda-email-cron');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  PERFORM cron.schedule(
    'daily-agenda-email-cron',
    cron_expr,
    $cmd$
    SELECT
      net.http_post(
        url := (SELECT value FROM cron_config WHERE key = 'supabase_url') || '/functions/v1/daily-agenda-cron-trigger',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT value FROM cron_config WHERE key = 'cron_secret')
        ),
        body := jsonb_build_object(
          'triggered_by', 'pg_cron',
          'timestamp', now()
        )
      ) as request_id;
    $cmd$
  );
  
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Recreate triggers
DROP TRIGGER IF EXISTS trigger_update_cron_schedule ON daily_email_config;
DROP TRIGGER IF EXISTS trigger_update_cron_schedule_insert ON daily_email_config;
DROP TRIGGER IF EXISTS trigger_update_cron_schedule_update ON daily_email_config;

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

-- Normalize timezone value to ET for consistency
UPDATE daily_email_config
SET send_time_timezone = 'America/New_York'
WHERE send_time_timezone IS DISTINCT FROM 'America/New_York' OR send_time_timezone IS NULL;
