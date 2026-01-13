-- Option 1: Trigger the cron job manually (simplest)
-- This executes the same command that runs at 5 AM
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
