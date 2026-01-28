-- Add a settings table to store the scheduled send time
CREATE TABLE IF NOT EXISTS daily_email_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  send_time_utc TIME NOT NULL DEFAULT '12:00:00', -- 7:00 AM EST
  send_time_timezone TEXT NOT NULL DEFAULT 'America/New_York',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default config
INSERT INTO daily_email_config (send_time_utc, send_time_timezone)
VALUES ('12:00:00', 'America/New_York')
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE daily_email_config ENABLE ROW LEVEL SECURITY;

-- Only admins can read/update
CREATE POLICY "Admins can read config" ON daily_email_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update config" ON daily_email_config
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Grant permissions
GRANT SELECT, UPDATE ON daily_email_config TO authenticated;

-- Add comment
COMMENT ON TABLE daily_email_config IS 'Configuration for daily agenda email schedule';

-- Create a function to update the cron schedule when config changes
CREATE OR REPLACE FUNCTION update_daily_email_cron_schedule()
RETURNS TRIGGER 
SECURITY DEFINER  -- Allows function to access cron schema
SET search_path = public, cron
AS $$
DECLARE
  hour_val INTEGER;
  minute_val INTEGER;
  cron_expr TEXT;
BEGIN
  -- Extract hour and minute from the time
  hour_val := EXTRACT(HOUR FROM NEW.send_time_utc);
  minute_val := EXTRACT(MINUTE FROM NEW.send_time_utc);
  
  -- Build cron expression (minute hour * * *)
  cron_expr := minute_val || ' ' || hour_val || ' * * *';
  
  -- Unschedule existing job (if exists)
  BEGIN
    PERFORM cron.unschedule('daily-agenda-email-cron');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Reschedule with new time
  PERFORM cron.schedule(
    'daily-agenda-email-cron',
    cron_expr,
    $$
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
    $$
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update cron schedule when config changes
CREATE TRIGGER trigger_update_cron_schedule
  AFTER UPDATE ON daily_email_config
  FOR EACH ROW
  WHEN (OLD.send_time_utc IS DISTINCT FROM NEW.send_time_utc)
  EXECUTE FUNCTION update_daily_email_cron_schedule();

-- Show current configuration
SELECT 
  send_time_utc,
  send_time_timezone,
  send_time_utc AT TIME ZONE send_time_timezone as local_time,
  updated_at
FROM daily_email_config;
