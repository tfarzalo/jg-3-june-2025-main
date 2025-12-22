-- STEP 1: Check what notification system you have
-- Run this first to understand your current setup

-- Check if send_notification function exists
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE '%notif%'
ORDER BY routine_name;

-- Check if user_notifications table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%notif%';

-- Check what triggers exist for notifications
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%notif%'
ORDER BY trigger_name;

-- Check if job_phase_change_notification trigger exists
SELECT 
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'job_phase_change_notification';
