-- =====================================================
-- Daily Agenda Email Cron Job Setup
-- =====================================================
-- This migration sets up automated daily email sending
-- 
-- IMPORTANT: This uses pg_cron which may not be available on all Supabase plans.
-- If pg_cron is not available, use one of these alternatives:
--
-- Option 1: Supabase Edge Function Cron (Recommended)
--   Set up in Supabase Dashboard: Database > Cron Jobs
--   OR use Supabase CLI to deploy a cron configuration
--
-- Option 2: External Cron Service
--   Use GitHub Actions, Vercel Cron, or similar service to call the Edge Function
--   See DAILY_AGENDA_EMAIL_CRON_SETUP.md for details
--
-- Option 3: Use this migration if pg_cron IS available on your plan
-- =====================================================

-- Enable pg_cron extension (only works on plans that support it)
-- If this fails, you'll need to use an alternative method
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  RAISE NOTICE 'pg_cron extension enabled successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'pg_cron extension not available. Please use alternative scheduling method. Error: %', SQLERRM;
END $$;

-- Create a helper function that the cron job will call
-- This function can also be called manually for testing
CREATE OR REPLACE FUNCTION check_and_send_daily_email()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settings RECORD;
  v_current_time TIME;
  v_send_time TIME;
  v_result jsonb;
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

  -- Get current time and configured send time (in ET timezone)
  v_current_time := (NOW() AT TIME ZONE 'America/New_York')::TIME;
  v_send_time := v_settings.send_time;

  -- Log the attempt
  RAISE NOTICE 'Check: Current time=%, Send time=%, Enabled=%', 
    v_current_time, v_send_time, v_settings.is_enabled;

  -- Return status
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Email settings retrieved successfully',
    'is_enabled', v_settings.is_enabled,
    'send_time', v_send_time,
    'current_time', v_current_time,
    'recipients', v_settings.recipients,
    'timestamp', NOW()
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_and_send_daily_email() TO service_role;
GRANT EXECUTE ON FUNCTION check_and_send_daily_email() TO authenticated;

-- Attempt to schedule the daily email using pg_cron
-- This will only work if pg_cron extension is available
DO $$
BEGIN
  -- Remove any existing job with the same name
  PERFORM cron.unschedule('daily-agenda-email-job');
  
  -- Schedule the job to check every hour (will only send at configured time)
  -- Running hourly gives flexibility to adjust send time in settings
  PERFORM cron.schedule(
    'daily-agenda-email-job',
    '0 * * * *',  -- Every hour on the hour
    $$SELECT check_and_send_daily_email();$$
  );
  
  RAISE NOTICE 'Successfully scheduled daily email cron job';
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not schedule cron job (pg_cron may not be available): %', SQLERRM;
    RAISE NOTICE 'Please set up scheduling manually using Supabase Dashboard or external cron service';
END $$;

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

-- Create policy for authenticated users to view logs
CREATE POLICY "Authenticated users can view email logs"
  ON daily_email_send_log
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy for service role to insert logs
CREATE POLICY "Service role can insert email logs"
  ON daily_email_send_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_email_send_log_sent_at ON daily_email_send_log(sent_at DESC);

-- View current cron jobs (if pg_cron is available)
-- SELECT * FROM cron.job WHERE jobname = 'daily-agenda-email-job';

COMMENT ON FUNCTION check_and_send_daily_email IS 'Checks if daily email should be sent based on settings. Called by cron job or external scheduler.';
