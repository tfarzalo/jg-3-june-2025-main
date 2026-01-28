-- Alternative: Trigger Email Immediately (Right Now)
-- Use this if you want to test the system immediately instead of waiting until 10:40 AM
--
-- INSTRUCTIONS:
-- 1. Connect to your database: supabase db remote connect
-- 2. Run this file: \i trigger_email_immediately.sql
-- 3. Exit: \q
--
-- This directly calls the HTTP endpoint from within the database
SELECT
  net.http_post(
    url := (SELECT value FROM cron_config WHERE key = 'supabase_url') || '/functions/v1/daily-agenda-cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM cron_config WHERE key = 'cron_secret')
    ),
    body := jsonb_build_object(
      'triggered_by', 'manual_test_immediate',
      'timestamp', now()
    )
  ) as request_id;

-- Check the result
SELECT * FROM daily_summary_log ORDER BY sent_at DESC LIMIT 1;

-- Check function logs with:
-- supabase functions logs daily-agenda-cron-trigger --tail
