-- Fix the Cron Job Configuration
-- This will recreate the cron job with the correct configuration

-- Step 1: Remove ALL old daily-agenda cron jobs
SELECT cron.unschedule(jobname) 
FROM cron.job 
WHERE jobname LIKE '%daily-agenda%';

-- Step 2: Verify they're gone
SELECT 'After cleanup - should be empty:' as status;
SELECT * FROM cron.job WHERE jobname LIKE '%daily-agenda%';

-- Step 3: Create the new cron job with proper config access
SELECT cron.schedule(
  'daily-agenda-email-cron',                    -- Job name
  '0 12 * * *',                                 -- 12:00 PM UTC = 7:00 AM EST
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

-- Step 4: Verify the new job is scheduled correctly
SELECT 'New cron job created:' as status;
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobname = 'daily-agenda-email-cron';

-- Step 5: Test that config values are accessible
SELECT 'Testing config access:' as status;
SELECT 
  (SELECT value FROM cron_config WHERE key = 'supabase_url') as url,
  CASE 
    WHEN (SELECT value FROM cron_config WHERE key = 'cron_secret') IS NOT NULL 
    THEN 'Secret is set' 
    ELSE 'Secret is missing!' 
  END as secret_status;
