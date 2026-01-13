-- =====================================================
-- VERIFY EMAIL SYSTEM CONFIGURATION (READ-ONLY)
-- =====================================================
-- This script checks all components required for the daily email.
-- It does NOT send any emails.
-- =====================================================

DO $$
DECLARE
  v_http_enabled boolean;
  v_job_exists boolean;
  v_schedule text;
  v_command text;
  v_recipient_count integer;
  v_edge_function_url text;
BEGIN
  RAISE NOTICE '------------------------------------------------';
  RAISE NOTICE '🔍 STARTING SYSTEM VERIFICATION';
  RAISE NOTICE '------------------------------------------------';

  -- 1. Check HTTP Extension
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') INTO v_http_enabled;
  
  IF v_http_enabled THEN
    RAISE NOTICE '✅ HTTP Extension: Enabled';
  ELSE
    RAISE WARNING '❌ HTTP Extension: MISSING (Required for Edge Functions)';
  END IF;

  -- 2. Check Cron Job
  SELECT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-agenda-email-job') INTO v_job_exists;
  
  IF v_job_exists THEN
    SELECT schedule, command INTO v_schedule, v_command FROM cron.job WHERE jobname = 'daily-agenda-email-job';
    RAISE NOTICE '✅ Cron Job: Found';
    RAISE NOTICE '   • Schedule: %', v_schedule;
    
    -- Extract URL from command for verification (simple string check)
    IF v_command LIKE '%functions/v1/send-daily-agenda-email%' THEN
      RAISE NOTICE '   • Target URL: Correct (points to send-daily-agenda-email)';
    ELSE
      RAISE WARNING '   • Target URL: SUSPICIOUS (Check command in cron.job)';
    END IF;
    
    -- Check Schedule Time
    IF v_schedule = '0 10 * * *' THEN
      RAISE NOTICE '   • Timing: Correct (5:00 AM EST / 10:00 UTC)';
    ELSIF v_schedule = '0 12 * * *' THEN
      RAISE WARNING '   • Timing: WARNING (7:00 AM EST / 12:00 UTC) - Run fix script to change to 5 AM';
    ELSE
      RAISE NOTICE '   • Timing: Custom (%)', v_schedule;
    END IF;
    
  ELSE
    RAISE WARNING '❌ Cron Job: MISSING (Run FIX_DAILY_EMAIL_SCHEDULE_AND_CHECK.sql)';
  END IF;

  -- 3. Check Recipients
  SELECT COUNT(*) INTO v_recipient_count FROM daily_email_settings WHERE enabled = true;
  
  IF v_recipient_count > 0 THEN
    RAISE NOTICE '✅ Recipients: % user(s) enabled', v_recipient_count;
  ELSE
    RAISE WARNING '❌ Recipients: NONE (No emails will be sent! Enable in Admin Settings)';
  END IF;

  RAISE NOTICE '------------------------------------------------';
  RAISE NOTICE '🏁 VERIFICATION COMPLETE';
  RAISE NOTICE '------------------------------------------------';
END $$;
