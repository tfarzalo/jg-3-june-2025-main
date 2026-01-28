-- =====================================================
-- DIAGNOSE: Frontend Schedule Not Syncing to Cron
-- =====================================================
-- Issue: Frontend shows 6 AM EST, but cron might not be updating

\echo '=== 🔍 Step 1: Check which table is being used ==='
\echo ''

-- Check if daily_email_config table exists
SELECT 
  '✅ daily_email_config table EXISTS' AS status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'daily_email_config'
UNION ALL
SELECT 
  '❌ daily_email_config table DOES NOT EXIST' AS status
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name = 'daily_email_config'
);

\echo ''
\echo '=== 📊 Step 2: Check current configuration ==='
\echo ''

-- Check daily_email_config (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_email_config') THEN
    RAISE NOTICE 'Checking daily_email_config table:';
    PERFORM * FROM daily_email_config;
  END IF;
END $$;

SELECT 
  'daily_email_config' AS source,
  send_time_utc AS "Time Stored",
  send_time_timezone AS "Timezone",
  send_time_utc::text || ' ' || send_time_timezone AS "Full Config",
  updated_at AS "Last Updated"
FROM daily_email_config
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_email_config');

-- Check app_settings (alternative location)
SELECT 
  'app_settings' AS source,
  value->>'hour' AS "Hour",
  value->>'timezone' AS "Timezone",
  (value->>'hour') || ':00 ' || (value->>'timezone') AS "Full Config",
  updated_at AS "Last Updated"
FROM app_settings
WHERE key = 'daily_agenda_email_schedule';

\echo ''
\echo '=== 🤖 Step 3: Check cron job configuration ==='
\echo ''

SELECT 
  jobname AS "Job Name",
  schedule AS "Cron Expression",
  CASE schedule
    WHEN '0 11 * * *' THEN '✅ 11:00 UTC = 6:00 AM EST (CORRECT for 6 AM)'
    WHEN '0 12 * * *' THEN '⚠️  12:00 UTC = 7:00 AM EST (WRONG - should be 11:00 for 6 AM)'
    ELSE '❌ UNEXPECTED: ' || schedule
  END AS "Status",
  CASE 
    WHEN active THEN '✅ Active' 
    ELSE '❌ Inactive' 
  END AS "Active",
  command AS "Command"
FROM cron.job
WHERE jobname LIKE '%daily%' OR jobname LIKE '%agenda%';

\echo ''
\echo '=== 🔧 Step 4: Check if trigger function exists ==='
\echo ''

SELECT 
  p.proname AS "Function Name",
  CASE 
    WHEN p.proname IS NOT NULL THEN '✅ Function EXISTS'
    ELSE '❌ Function NOT FOUND'
  END AS "Status",
  pg_get_functiondef(p.oid) AS "Function Definition"
FROM pg_proc p
WHERE p.proname = 'update_daily_email_cron_schedule'
UNION ALL
SELECT 
  'update_daily_email_cron_schedule',
  '❌ Function NOT FOUND',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM pg_proc 
  WHERE proname = 'update_daily_email_cron_schedule'
);

\echo ''
\echo '=== 🔗 Step 5: Check if trigger is attached ==='
\echo ''

SELECT 
  t.tgname AS "Trigger Name",
  CASE 
    WHEN t.tgname IS NOT NULL THEN '✅ Trigger EXISTS'
    ELSE '❌ Trigger NOT FOUND'
  END AS "Status",
  pg_get_triggerdef(t.oid) AS "Trigger Definition"
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'daily_email_config'
  AND t.tgname LIKE '%cron%'
UNION ALL
SELECT 
  'update_cron_on_config_change',
  '❌ Trigger NOT FOUND',
  'No trigger found on daily_email_config table'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  WHERE c.relname = 'daily_email_config'
    AND t.tgname LIKE '%cron%'
);

\echo ''
\echo '=== 🕐 Step 6: Timezone conversion check ==='
\echo ''

WITH expected AS (
  -- Frontend says 6 AM EST
  SELECT 
    '6:00 AM EST' AS desired_time,
    '11:00 UTC' AS expected_utc,
    '0 11 * * *' AS expected_cron
)
SELECT 
  desired_time AS "Desired Time",
  expected_utc AS "Should be UTC",
  expected_cron AS "Should be Cron",
  (SELECT schedule FROM cron.job WHERE jobname LIKE '%daily%agenda%' LIMIT 1) AS "Actual Cron",
  CASE 
    WHEN (SELECT schedule FROM cron.job WHERE jobname LIKE '%daily%agenda%' LIMIT 1) = expected_cron 
    THEN '✅ CORRECT'
    ELSE '❌ MISMATCH - Cron needs to be updated!'
  END AS "Status"
FROM expected;

\echo ''
\echo '=== 📝 Step 7: Summary & Diagnosis ==='
\echo ''

-- Provide diagnosis
WITH diagnosis AS (
  SELECT
    CASE 
      WHEN NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_email_config')
      THEN 'PROBLEM: daily_email_config table does not exist'
      WHEN NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_daily_email_cron_schedule')
      THEN 'PROBLEM: Trigger function update_daily_email_cron_schedule() does not exist'
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        WHERE c.relname = 'daily_email_config' AND t.tgname LIKE '%cron%'
      )
      THEN 'PROBLEM: Trigger is not attached to daily_email_config table'
      WHEN (SELECT schedule FROM cron.job WHERE jobname LIKE '%daily%agenda%' LIMIT 1) != '0 11 * * *'
      THEN 'PROBLEM: Cron schedule is wrong (should be "0 11 * * *" for 6 AM EST)'
      ELSE 'System appears configured correctly'
    END AS diagnosis
)
SELECT diagnosis AS "🎯 DIAGNOSIS" FROM diagnosis;

\echo ''
\echo '=== 💡 Recommended Fix ==='
\echo ''

SELECT 
  '1. Check if daily_email_config table exists' AS "Step",
  '2. Verify trigger function exists' AS "Step 2",
  '3. Verify trigger is attached' AS "Step 3",
  '4. Manually update cron job to match frontend setting' AS "Step 4";

\echo ''
\echo '=== 🔧 Quick Fix: Manually Update Cron to 6 AM EST ==='
\echo ''
\echo 'Run this to fix the cron schedule immediately:'
\echo ''
\echo 'SELECT cron.schedule('
\echo '  ''send-daily-agenda-email'','
\echo '  ''0 11 * * *'',  -- 11:00 UTC = 6:00 AM EST'
\echo '  $$ ... $$'
\echo ');'
\echo ''
