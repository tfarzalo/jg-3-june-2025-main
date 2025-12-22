-- =====================================================
-- SIMPLE Daily Agenda Email Cron Job Setup
-- =====================================================
-- Copy and paste this into Supabase SQL Editor
-- =====================================================

-- Step 1: Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Step 2: Create helper function
CREATE OR REPLACE FUNCTION trigger_daily_email()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function will be called by cron
  -- The actual email sending is done by the Edge Function
  RAISE NOTICE 'Daily email cron job triggered at %', NOW();
END;
$$;

-- Step 3: Create log table
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

ALTER TABLE daily_email_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view email logs" ON daily_email_send_log;
CREATE POLICY "Authenticated users can view email logs"
  ON daily_email_send_log FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role can insert email logs" ON daily_email_send_log;
CREATE POLICY "Service role can insert email logs"
  ON daily_email_send_log FOR INSERT TO service_role WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_daily_email_send_log_sent_at ON daily_email_send_log(sent_at DESC);

-- Step 4: Safely remove existing job if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-agenda-email-job') THEN
    PERFORM cron.unschedule('daily-agenda-email-job');
  END IF;
END $$;

-- Step 5: Schedule the cron job
-- This will call the trigger function every weekday at 9:00 AM UTC (5:00 AM ET)
SELECT cron.schedule(
  'daily-agenda-email-job',
  '0 9 * * 1-5',
  'SELECT trigger_daily_email();'
);

-- Step 6: Verify the job was created
SELECT 
  jobname, 
  schedule, 
  command,
  active
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job';

-- IMPORTANT: After running this, you still need to use GitHub Actions
-- OR create a database webhook to actually trigger the Edge Function
-- This pg_cron job creates a schedule, but we need a way to call the Edge Function
