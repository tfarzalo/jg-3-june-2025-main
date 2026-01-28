-- Test the email function directly and capture the response
WITH http_response AS (
  SELECT
    net.http_post(
      url := (SELECT value FROM cron_config WHERE key = 'supabase_url') || '/functions/v1/daily-agenda-cron-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM cron_config WHERE key = 'cron_secret')
      ),
      body := jsonb_build_object(
        'triggered_by', 'manual_debug_test',
        'timestamp', now()
      )
    ) as response
)
SELECT 
  response::text as full_response
FROM http_response;

-- Wait 5 seconds for processing
SELECT pg_sleep(5);

-- Check if anything was logged
SELECT 
  'After 5 second wait:' as status,
  COUNT(*) as log_count
FROM daily_summary_log;

-- Show any logs
SELECT * FROM daily_summary_log ORDER BY sent_at DESC LIMIT 3;

-- Also check if the send-daily-agenda-email function exists and works
-- by calling it directly
SELECT
  'Testing send-daily-agenda-email directly:' as test,
  net.http_post(
    url := (SELECT value FROM cron_config WHERE key = 'supabase_url') || '/functions/v1/send-daily-agenda-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM cron_config WHERE key = 'cron_secret')
    ),
    body := jsonb_build_object(
      'mode', 'all',
      'test', false
    )
  )::text as direct_response;
