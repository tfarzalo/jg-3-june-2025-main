-- Configure Cron Settings for Daily Agenda Automation
-- Run this after the 20260123_setup_daily_cron.sql migration

-- Set Supabase URL
INSERT INTO cron_config (key, value) 
VALUES ('supabase_url', 'https://tbwtfimnbmvbgesidbxh.supabase.co') 
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Set Cron Secret
INSERT INTO cron_config (key, value) 
VALUES ('cron_secret', 'c95caf6d6155c2e6eb093783298864b968009503c05b7d55954ce329027f0aac') 
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Verify configuration
SELECT * FROM cron_config ORDER BY key;

-- Verify cron job is scheduled
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job 
WHERE jobname = 'daily-agenda-email-cron';
