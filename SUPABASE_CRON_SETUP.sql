-- =====================================================
-- Daily Agenda Email Cron Job Setup - Supabase pg_cron
-- =====================================================
-- Run this in Supabase SQL Editor after enabling pg_cron
-- =====================================================

-- Enable pg_cron extension (if not already enabled from Integrations page)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a helper function that checks email settings
CREATE OR REPLACE FUNCTION check_and_send_daily_email()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings RECORD;
BEGIN
  -- Get the daily email settings
  SELECT * INTO v_settings
  FROM daily_agenda_email_settings
  WHERE id = 1
  LIMIT 1;

  -- If no settings found, return early
  IF v_settings IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No email settings found',
      'timestamp', NOW()
    );
  END IF;

  -- Check if email is enabled
  IF NOT v_settings.is_enabled THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Daily email is disabled',
      'timestamp', NOW()
    );
  END IF;

  -- Return status
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Email settings retrieved successfully',
    'is_enabled', v_settings.is_enabled,
    'send_time', v_settings.send_time,
    'recipients', v_settings.recipients,
    'timestamp', NOW()
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_and_send_daily_email() TO service_role;
GRANT EXECUTE ON FUNCTION check_and_send_daily_email() TO authenticated;

-- Create a log table for tracking email sends
CREATE TABLE IF NOT EXISTS daily_email_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recipients TEXT[],
  job_count INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  triggered_by TEXT DEFAULT 'cron',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE daily_email_send_log ENABLE ROW LEVEL SECURITY;

-- Create policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Authenticated users can view email logs" ON daily_email_send_log;
CREATE POLICY "Authenticated users can view email logs"
  ON daily_email_send_log
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role can insert email logs" ON daily_email_send_log;
CREATE POLICY "Service role can insert email logs"
  ON daily_email_send_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Add index
CREATE INDEX IF NOT EXISTS idx_daily_email_send_log_sent_at ON daily_email_send_log(sent_at DESC);

-- Remove any existing cron job with the same name (safe version)
DO $$
BEGIN
  PERFORM cron.unschedule('daily-agenda-email-job');
EXCEPTION
  WHEN OTHERS THEN
    -- Job doesn't exist yet, that's fine
    NULL;
END $$;

-- Enable http extension (required for making HTTP requests)
CREATE EXTENSION IF NOT EXISTS http;

-- Schedule the job to run every weekday at 9:00 AM UTC (5:00 AM ET)
-- This calls the Edge Function directly
SELECT cron.schedule(
  'daily-agenda-email-job',
  '0 9 * * 1-5',  -- 9:00 AM UTC on weekdays (Mon-Fri) = 5:00 AM ET
  $$
  SELECT 
    content::json->>'message' as result
  FROM 
    http((
      'POST',
      'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email',
      ARRAY[
        http_header('Content-Type', 'application/json'),
        http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true))
      ],
      'application/json',
      '{"action": "send_daily_email", "manual": false}'
    )::http_request);
  $$
);

-- View the scheduled job to confirm it was created
SELECT 
  jobname, 
  schedule, 
  active,
  jobid
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job';
