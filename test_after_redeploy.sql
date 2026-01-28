-- Test after redeploying with --no-verify-jwt
-- The function should now work!

-- Trigger the email send
SELECT
  'Calling function...' as status,
  net.http_post(
    url := (SELECT value FROM cron_config WHERE key = 'supabase_url') || '/functions/v1/daily-agenda-cron-trigger',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM cron_config WHERE key = 'cron_secret')
    ),
    body := jsonb_build_object(
      'triggered_by', 'test_after_redeploy',
      'timestamp', now()
    )
  ) as request_id;

-- Wait 10 seconds for processing
SELECT pg_sleep(10);

-- Check if it logged
SELECT 
  'Result:' as status,
  sent_at AT TIME ZONE 'America/New_York' as sent_at_et,
  recipient_count,
  success_count,
  failure_count,
  triggered_by,
  error_details
FROM daily_summary_log 
ORDER BY sent_at DESC 
LIMIT 1;

-- If no result, show count
SELECT 
  'Total logs:' as status,
  COUNT(*) as total
FROM daily_summary_log;
