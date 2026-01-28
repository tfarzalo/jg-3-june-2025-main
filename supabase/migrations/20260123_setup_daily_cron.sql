-- Migration: Setup Daily Agenda Cron Job
-- Created: 2026-01-23
-- Purpose: Schedule automatic daily agenda email sending
-- 
-- IMPORTANT: This uses a secure config table instead of database parameters
-- to avoid permission issues with Supabase's managed Postgres

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a secure configuration table for cron settings
CREATE TABLE IF NOT EXISTS cron_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS to keep it secure
ALTER TABLE cron_config ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table
CREATE POLICY "Service role only" ON cron_config
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Grant necessary cron permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Unschedule existing job if it exists (for re-runs)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-agenda-email-cron') THEN
    PERFORM cron.unschedule('daily-agenda-email-cron');
  END IF;
END $$;

-- Schedule daily agenda to run at 7:00 AM Eastern Time
-- Note: ET is UTC-5 (EST) or UTC-4 (EDT depending on DST)
-- Running at 12:00 PM UTC = 7:00 AM EST / 8:00 AM EDT
-- Adjust the hour (12) if you want a different send time

SELECT cron.schedule(
  'daily-agenda-email-cron',                    -- Job name
  '0 12 * * *',                                 -- Cron expression: 12:00 PM UTC = 7:00 AM EST
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

-- Display scheduled job
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job 
WHERE jobname = 'daily-agenda-email-cron';

-- Add helpful comments
COMMENT ON TABLE cron_config IS 'Secure configuration storage for cron job settings';
COMMENT ON EXTENSION pg_cron IS 'PostgreSQL cron scheduler for automated daily agenda emails';

-- Instructions for setting configuration values (run these after this migration):
-- INSERT INTO cron_config (key, value) VALUES ('supabase_url', 'https://YOUR_PROJECT_ID.supabase.co') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
-- INSERT INTO cron_config (key, value) VALUES ('cron_secret', 'YOUR_CRON_SECRET') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Instructions for viewing job execution history:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-agenda-email-cron') ORDER BY start_time DESC LIMIT 10;

-- Instructions for changing the schedule:
-- SELECT cron.unschedule('daily-agenda-email-cron');
-- Then re-run the SELECT cron.schedule with your desired time

-- Cron expression examples:
-- '0 12 * * *'     = 12:00 PM UTC (7:00 AM EST)
-- '0 11 * * *'     = 11:00 AM UTC (6:00 AM EST)
-- '0 13 * * *'     = 1:00 PM UTC (8:00 AM EST)
-- '0 12 * * 1-5'   = 12:00 PM UTC Mon-Fri only (weekdays)
