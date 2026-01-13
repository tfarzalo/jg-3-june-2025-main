-- =====================================================
-- VERIFY EMAIL SYSTEM (TABLE VIEW)
-- =====================================================
-- Run this script to see a clear table of results.
-- =====================================================

SELECT * FROM (
  -- 1. HTTP Extension Check
  SELECT 
    1 as step,
    'HTTP Extension' as check_name,
    CASE 
      WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN '✅ Enabled' 
      ELSE '❌ Missing' 
    END as status,
    'Required for Edge Functions' as details

  UNION ALL

  -- 2. Cron Job Check
  SELECT 
    2,
    'Cron Job Exists',
    CASE 
      WHEN EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-agenda-email-job') THEN '✅ Found' 
      ELSE '❌ Missing' 
    END,
    'Job name: daily-agenda-email-job'

  UNION ALL

  -- 3. Schedule Check
  SELECT 
    3,
    'Cron Schedule',
    COALESCE((SELECT schedule FROM cron.job WHERE jobname = 'daily-agenda-email-job'), 'N/A'),
    CASE 
      WHEN (SELECT schedule FROM cron.job WHERE jobname = 'daily-agenda-email-job') = '0 10 * * *' THEN '✅ Correct (5 AM ET)'
      WHEN (SELECT schedule FROM cron.job WHERE jobname = 'daily-agenda-email-job') = '0 12 * * *' THEN '⚠️ Warning (7 AM ET)'
      ELSE 'ℹ️ Custom Schedule' 
    END

  UNION ALL

  -- 4. Target URL Check
  SELECT 
    4,
    'Target URL',
    COALESCE((SELECT SUBSTRING(command FROM 'functions/v1/([^"'']*)') FROM cron.job WHERE jobname = 'daily-agenda-email-job'), 'Unknown'),
    CASE 
      WHEN (SELECT command FROM cron.job WHERE jobname = 'daily-agenda-email-job') LIKE '%functions/v1/send-daily-agenda-email%' THEN '✅ Correct Function'
      ELSE '❌ Incorrect URL' 
    END

  UNION ALL

  -- 5. Recipients Check
  SELECT
    5,
    'Recipients Enabled',
    (SELECT COUNT(*)::text FROM daily_email_settings WHERE enabled = true),
    CASE 
      WHEN (SELECT COUNT(*) FROM daily_email_settings WHERE enabled = true) > 0 THEN '✅ Emails will send'
      ELSE '❌ NO RECIPIENTS (Enable in Admin)' 
    END
) sub
ORDER BY step;
