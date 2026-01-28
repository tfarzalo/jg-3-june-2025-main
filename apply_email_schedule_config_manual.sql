-- ============================================================================
-- MANUAL MIGRATION: Add Email Schedule Configuration
-- Run this in your Supabase SQL Editor or via psql
-- ============================================================================

-- Step 1: Create the config table
CREATE TABLE IF NOT EXISTS daily_email_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  send_time_utc TIME NOT NULL DEFAULT '12:00:00',
  send_time_timezone TEXT NOT NULL DEFAULT 'America/New_York',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Step 2: Insert default configuration (12:00 UTC = 7:00 AM EST)
INSERT INTO daily_email_config (send_time_utc, send_time_timezone)
VALUES ('12:00:00', 'America/New_York')
ON CONFLICT DO NOTHING;

-- Step 3: Enable Row Level Security
ALTER TABLE daily_email_config ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policy for reading config (admins only)
CREATE POLICY "Admins can read config" ON daily_email_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Step 5: Create RLS policy for updating config (admins only)
CREATE POLICY "Admins can update config" ON daily_email_config
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Step 6: Grant permissions
GRANT SELECT, UPDATE ON daily_email_config TO authenticated;

-- Step 7: Add table comment
COMMENT ON TABLE daily_email_config IS 'Configuration for daily agenda email schedule';

-- Step 8: Create function to auto-update cron schedule when time changes
CREATE OR REPLACE FUNCTION update_daily_email_cron_schedule()
RETURNS TRIGGER 
SECURITY DEFINER  -- Allows function to access cron schema
SET search_path = public, cron
AS $func$
DECLARE
  hour_val INTEGER;
  minute_val INTEGER;
  cron_expr TEXT;
  cron_command TEXT;
BEGIN
  -- Extract hour and minute from the time
  hour_val := EXTRACT(HOUR FROM NEW.send_time_utc);
  minute_val := EXTRACT(MINUTE FROM NEW.send_time_utc);
  
  -- Build cron expression (minute hour * * *)
  cron_expr := minute_val || ' ' || hour_val || ' * * *';
  
  -- Build the command to execute
  cron_command := 'SELECT net.http_post(url := (SELECT value FROM cron_config WHERE key = ''supabase_url'') || ''/functions/v1/daily-agenda-cron-trigger'', headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer '' || (SELECT value FROM cron_config WHERE key = ''cron_secret'')), body := jsonb_build_object(''triggered_by'', ''pg_cron'', ''timestamp'', now())) as request_id;';
  
  -- Unschedule existing job (if exists)
  BEGIN
    PERFORM cron.unschedule('daily-agenda-email-cron');
  EXCEPTION WHEN OTHERS THEN
    -- Job might not exist yet, that's OK
    NULL;
  END;
  
  -- Reschedule with new time
  PERFORM cron.schedule(
    'daily-agenda-email-cron',
    cron_expr,
    cron_command
  );
  
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Step 9: Create trigger that fires when send time is updated
CREATE TRIGGER trigger_update_cron_schedule
  AFTER UPDATE ON daily_email_config
  FOR EACH ROW
  WHEN (OLD.send_time_utc IS DISTINCT FROM NEW.send_time_utc)
  EXECUTE FUNCTION update_daily_email_cron_schedule();

-- Step 10: Verify setup
SELECT 
  'Configuration created successfully!' as status,
  send_time_utc,
  send_time_timezone,
  updated_at
FROM daily_email_config;

-- ============================================================================
-- VERIFICATION QUERIES (run these after to confirm everything works)
-- ============================================================================

-- Check table exists and has data
-- SELECT * FROM daily_email_config;

-- Check trigger exists
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trigger_update_cron_schedule';

-- Check function exists
-- SELECT proname FROM pg_proc WHERE proname = 'update_daily_email_cron_schedule';

-- Check current cron job
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'daily-agenda-email-cron';
