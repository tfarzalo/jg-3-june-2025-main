-- =====================================================
-- FIX DAILY AGENDA EMAIL SCHEDULE
-- =====================================================
-- This script resets the cron job with the CORRECT credentials.
--
-- INSTRUCTIONS:
-- 1. Look for [YOUR_PROJECT_REF] below and replace it with your Supabase Project Reference.
--    (It's the part of the URL like: https://[project-ref].supabase.co)
--    You can find this in your Supabase Dashboard URL.
--
-- 2. Look for [YOUR_SERVICE_ROLE_KEY] below and replace it with your "service_role" secret.
--    Find it in: Project Settings > API > Project API keys > service_role (secret)
--    ⚠️ IMPORTANT: Do NOT use the "anon" public key. Use the "service_role" secret.
--
-- 3. Run this entire script in the Supabase SQL Editor.
-- =====================================================

-- 1. Remove the old (broken) job
SELECT cron.unschedule('daily-agenda-email-job');

-- 2. Create the new job with correct credentials
-- Schedule: 5:00 AM ET (10:00 UTC)
SELECT cron.schedule(
  'daily-agenda-email-job',
  '0 10 * * *',
  $$
  SELECT 
    status,
    content::json->>'message' as result
  FROM 
    http((
      'POST',
      'https://[YOUR_PROJECT_REF].supabase.co/functions/v1/send-daily-agenda-email',
      ARRAY[
        http_header('Content-Type', 'application/json'),
        http_header('Authorization', 'Bearer [YOUR_SERVICE_ROLE_KEY]')
      ],
      'application/json',
      '{"mode": "all"}' 
    )::http_request);
  $$
);

-- 3. Verify the job was created
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job';

-- =====================================================
-- TROUBLESHOOTING
-- =====================================================
-- To check if previous attempts failed, run this:
/*
SELECT 
  runid,
  jobid,
  status,
  return_message,
  start_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
*/
