-- Set Cron Configuration Values for Daily Agenda Automation
-- Project: tbwtfimnbmvbgesidbxh
-- Date: 2026-01-23

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

-- Verify the values are set
SELECT key, 
       CASE 
         WHEN key = 'cron_secret' THEN '***REDACTED***'
         ELSE value 
       END as display_value,
       updated_at 
FROM cron_config 
ORDER BY key;

-- Expected output:
--        key        |              display_value              |         updated_at
-- ------------------+----------------------------------------+----------------------------
--  cron_secret      | ***REDACTED***                         | 2026-01-23 ...
--  supabase_url     | https://tbwtfimnbmvbgesidbxh.supabase.co | 2026-01-23 ...
