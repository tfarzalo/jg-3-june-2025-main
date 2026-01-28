-- Check if cron_config has the required values
SELECT * FROM cron_config ORDER BY key;

-- Check if the cron job can access the values
SELECT 
  'Testing config access' as test,
  (SELECT value FROM cron_config WHERE key = 'supabase_url') as url_test,
  (SELECT value FROM cron_config WHERE key = 'cron_secret') as secret_test;
