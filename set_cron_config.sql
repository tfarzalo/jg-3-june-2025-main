-- Set Cron Configuration Values
-- Run this AFTER running the 20260123_setup_daily_cron.sql migration
-- 
-- IMPORTANT: Replace the placeholder values with your actual values:
-- 1. YOUR_PROJECT_ID - Your Supabase project ID (from the dashboard URL)
-- 2. YOUR_CRON_SECRET - The secret you generated with: openssl rand -base64 32

-- Set Supabase URL
INSERT INTO cron_config (key, value) 
VALUES ('supabase_url', 'https://YOUR_PROJECT_ID.supabase.co') 
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Set Cron Secret
INSERT INTO cron_config (key, value) 
VALUES ('cron_secret', 'YOUR_CRON_SECRET') 
ON CONFLICT (key) 
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Verify the values are set
SELECT key, 
       CASE 
         WHEN key = 'cron_secret' THEN '***REDACTED***'
         ELSE value 
       END as value,
       updated_at 
FROM cron_config 
ORDER BY key;

-- Expected output:
--        key        |              value              |         updated_at
-- ------------------+---------------------------------+----------------------------
--  cron_secret      | ***REDACTED***                  | 2026-01-23 12:34:56.789+00
--  supabase_url     | https://yourproject.supabase.co | 2026-01-23 12:34:56.789+00
