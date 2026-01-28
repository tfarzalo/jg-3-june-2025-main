-- Test Schedule Change Functionality
-- This script tests the ability to change the daily email send time

-- 1. Check current configuration
SELECT 
  id,
  send_time_utc,
  send_time_timezone,
  updated_at,
  'Current configuration' as check_type
FROM daily_email_config;

-- 2. Check current cron job schedule
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  'Current cron schedule' as check_type
FROM cron.job
WHERE jobname = 'daily-agenda-email-cron';

-- 3. Test update (change to 13:00 UTC as example)
-- UNCOMMENT TO TEST:
-- UPDATE daily_email_config 
-- SET send_time_utc = '13:00:00',
--     updated_at = NOW()
-- WHERE id = (SELECT id FROM daily_email_config LIMIT 1);

-- 4. Check if trigger function exists
SELECT 
  proname as function_name,
  prosrc as function_source,
  'Trigger function status' as check_type
FROM pg_proc
WHERE proname = 'update_daily_email_cron_schedule';

-- 5. Check if trigger exists
SELECT 
  tgname as trigger_name,
  tgtype,
  tgenabled,
  'Trigger status' as check_type
FROM pg_trigger
WHERE tgname = 'trigger_update_cron_schedule';

-- 6. Check cron_config table for function URL
SELECT 
  key,
  value,
  'Cron config' as check_type
FROM cron_config
WHERE key IN ('supabase_url', 'cron_secret');

-- INSTRUCTIONS:
-- 1. Run this script to see current state
-- 2. Uncomment section 3 and run to test time change
-- 3. Check cron.job table again to verify schedule updated
-- 4. Test in UI by changing time and verifying cron job reschedules
