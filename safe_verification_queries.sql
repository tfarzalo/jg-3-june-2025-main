-- ============================================================================
-- SAFE VERIFICATION (No cron schema access needed)
-- Run these queries - they all work without special permissions
-- ============================================================================

-- ✅ 1. Check config table has data
SELECT 
  id,
  send_time_utc,
  send_time_timezone,
  updated_at,
  '✅ Config table exists' as status
FROM daily_email_config;

-- ✅ 2. Verify trigger function exists
SELECT 
  proname as function_name,
  '✅ Trigger function exists' as status
FROM pg_proc 
WHERE proname = 'update_daily_email_cron_schedule';

-- ✅ 3. Verify trigger exists and is enabled
SELECT 
  tgname as trigger_name,
  CASE tgenabled
    WHEN 'O' THEN '✅ Enabled (Origin)'
    WHEN 'D' THEN '❌ Disabled'
    ELSE '⚠️ Unknown status'
  END as status
FROM pg_trigger 
WHERE tgname = 'trigger_update_cron_schedule';

-- ✅ 4. Check RLS policies
SELECT 
  policyname,
  cmd,
  '✅ RLS policy active' as status
FROM pg_policies 
WHERE tablename = 'daily_email_config';

-- ✅ 5. Check if pg_cron extension is enabled
SELECT 
  extname,
  extversion,
  '✅ Extension enabled' as status
FROM pg_extension 
WHERE extname = 'pg_cron';

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- If all queries above return results, your setup is complete! ✅
-- 
-- Next steps:
-- 1. Go to /admin → Daily Agenda Email Settings
-- 2. Test changing the time in the UI
-- 3. Verify the update in the database
-- 4. Check Supabase Dashboard → Database → Extensions → pg_cron
--    to confirm cron job schedule matches your config
-- ============================================================================
