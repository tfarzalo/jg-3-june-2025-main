-- ============================================================================
-- VERIFICATION: Email Schedule Configuration
-- Run these queries to confirm everything is working
-- ============================================================================

-- 1. Check the config table has data
SELECT 
  id,
  send_time_utc,
  send_time_timezone,
  updated_at,
  'Config table OK' as check_status
FROM daily_email_config;

-- 2. Verify the trigger function exists
SELECT 
  proname as function_name,
  'Trigger function exists' as check_status
FROM pg_proc 
WHERE proname = 'update_daily_email_cron_schedule';

-- 3. Verify the trigger exists and is enabled
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  'Trigger exists and enabled' as check_status
FROM pg_trigger 
WHERE tgname = 'trigger_update_cron_schedule';

-- 4. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  'RLS policy exists' as check_status
FROM pg_policies 
WHERE tablename = 'daily_email_config';

-- 5. Check current cron job schedule
-- NOTE: You may need superuser/postgres role to query cron.job
-- If you get permission denied, check via Supabase Dashboard > Database > Extensions > pg_cron
-- Or run this as postgres user:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'daily-agenda-email-cron';

-- Alternative: Check if cron extension is enabled
SELECT 
  extname as extension_name,
  extversion as version,
  'pg_cron extension status' as check_status
FROM pg_extension 
WHERE extname = 'pg_cron';

-- ============================================================================
-- TEST: Update the time and verify cron reschedules
-- ============================================================================

-- Test changing the time to 14:00 (2:00 PM UTC)
-- This will trigger the function that reschedules the cron job
-- UNCOMMENT TO TEST:
/*
UPDATE daily_email_config 
SET send_time_utc = '14:00:00',
    updated_at = NOW()
WHERE id = (SELECT id FROM daily_email_config LIMIT 1);

-- Verify the update was saved
SELECT 
  send_time_utc,
  updated_at,
  'Time updated to 14:00' as status
FROM daily_email_config;

-- NOTE: The trigger will automatically reschedule the cron job
-- To verify cron updated, check Supabase Dashboard or run as postgres:
-- SELECT schedule FROM cron.job WHERE jobname = 'daily-agenda-email-cron';

-- Change it back to 12:00
UPDATE daily_email_config 
SET send_time_utc = '12:00:00',
    updated_at = NOW()
WHERE id = (SELECT id FROM daily_email_config LIMIT 1);
*/

-- ============================================================================
-- ALTERNATIVE: Check via Supabase Dashboard
-- ============================================================================
-- To view cron jobs:
-- 1. Go to Supabase Dashboard
-- 2. Database > Extensions > pg_cron
-- 3. Look for job: 'daily-agenda-email-cron'
-- 4. Verify schedule matches send_time_utc

-- ============================================================================
-- Ready for UI testing!
-- Next step: Go to /admin and test the time picker
-- ============================================================================
