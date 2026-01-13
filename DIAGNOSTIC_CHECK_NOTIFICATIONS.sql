-- DIAGNOSTIC: Check Notification System Status
-- Run this in Supabase SQL Editor to verify the migration was applied correctly

-- =============================================================================
-- PART 1: Check if functions exist and were updated
-- =============================================================================

-- Check if notify_job_phase_change function exists
SELECT 
  routine_name,
  routine_type,
  data_type,
  character_maximum_length,
  routine_definition
FROM information_schema.routines
WHERE routine_name = 'notify_job_phase_change'
  AND routine_schema = 'public';

-- Check if send_notification function exists
SELECT 
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_name = 'send_notification'
  AND routine_schema = 'public';

-- =============================================================================
-- PART 2: Check if triggers are active
-- =============================================================================

-- Check job_phase_change_notification trigger
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'job_phase_change_notification';

-- =============================================================================
-- PART 3: Check table structure
-- =============================================================================

-- Check user_notifications table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_notifications'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check job_phase_changes table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'job_phase_changes'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- =============================================================================
-- PART 4: Check recent notifications
-- =============================================================================

-- Check last 5 notifications created
SELECT 
  id,
  user_id,
  title,
  message,
  type,
  is_read,
  created_at,
  (SELECT full_name FROM profiles WHERE id = user_notifications.user_id) as recipient_name
FROM user_notifications
ORDER BY created_at DESC
LIMIT 5;

-- =============================================================================
-- PART 5: Check recent job phase changes
-- =============================================================================

-- Check last 5 job phase changes
SELECT 
  jpc.id,
  jpc.job_id,
  jpc.changed_by,
  jpc.changed_at,
  (SELECT full_name FROM profiles WHERE id = jpc.changed_by) as changed_by_name,
  fp.job_phase_label as from_phase,
  tp.job_phase_label as to_phase
FROM job_phase_changes jpc
LEFT JOIN job_phases fp ON fp.id = jpc.from_phase_id
JOIN job_phases tp ON tp.id = jpc.to_phase_id
ORDER BY jpc.changed_at DESC
LIMIT 5;

-- =============================================================================
-- PART 6: Check if notification was created for recent phase change
-- =============================================================================

-- For the most recent job phase change, check if notifications were created
WITH recent_change AS (
  SELECT 
    id,
    job_id,
    changed_by,
    changed_at
  FROM job_phase_changes
  ORDER BY changed_at DESC
  LIMIT 1
)
SELECT 
  rc.changed_at as phase_change_time,
  (SELECT full_name FROM profiles WHERE id = rc.changed_by) as who_made_change,
  un.created_at as notification_time,
  (SELECT full_name FROM profiles WHERE id = un.user_id) as who_got_notified,
  un.title,
  un.message,
  un.is_read
FROM recent_change rc
LEFT JOIN user_notifications un ON 
  un.reference_id = rc.job_id 
  AND un.type = 'job_phase_change'
  AND un.created_at >= rc.changed_at
ORDER BY un.created_at DESC;

-- =============================================================================
-- PART 7: Check current user's profile and role
-- =============================================================================

-- Check your own profile
SELECT 
  id,
  full_name,
  email,
  role,
  notification_settings
FROM profiles
WHERE id = auth.uid();

-- =============================================================================
-- PART 8: Summary Check
-- =============================================================================

-- This will show if the system is working correctly
SELECT 
  'Function exists' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'notify_job_phase_change'
    ) THEN '✅ YES' 
    ELSE '❌ NO' 
  END as status

UNION ALL

SELECT 
  'Trigger exists',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = 'job_phase_change_notification'
    ) THEN '✅ YES' 
    ELSE '❌ NO' 
  END

UNION ALL

SELECT 
  'user_notifications table exists',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'user_notifications'
    ) THEN '✅ YES' 
    ELSE '❌ NO' 
  END

UNION ALL

SELECT 
  'Recent notifications exist',
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_notifications 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    ) THEN '✅ YES (' || COUNT(*)::text || ')' 
    ELSE '❌ NO' 
  END
FROM user_notifications
WHERE created_at > NOW() - INTERVAL '24 hours';

-- =============================================================================
-- DEBUGGING NOTES:
-- =============================================================================
-- 
-- If you don't see notifications:
-- 1. Check if you changed the job phase yourself (you shouldn't get notified)
-- 2. Check if you're an admin or jg_management (only they get notifications)
-- 3. Check if notification_settings allows job_phase_changes notifications
-- 4. Check if the trigger is firing by looking at recent job_phase_changes
-- 5. Check if send_notification is being called (check Part 6 results)
--
-- Expected behavior:
-- - You change a job phase → NO notification for you
-- - Someone else changes a job phase → YES notification for you (if admin/jg_management)
-- - All changes visible in Activity Log
