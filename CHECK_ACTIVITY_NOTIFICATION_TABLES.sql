-- =====================================================
-- CHECK: What tables exist for activity/notification logging?
-- =====================================================

-- 1. Check if user_notifications table exists
SELECT 
  'user_notifications table' as check_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_notifications'
ORDER BY ordinal_position;

-- 2. Check if activity_logs table exists
SELECT 
  'activity_logs table' as check_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'activity_logs'
ORDER BY ordinal_position;

-- 3. Check if job_activity table exists
SELECT 
  'job_activity table' as check_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'job_activity'
ORDER BY ordinal_position;

-- 4. Check what tables have 'activity' or 'log' or 'notification' in the name
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%activity%' 
    OR table_name ILIKE '%log%'
    OR table_name ILIKE '%notification%'
  )
ORDER BY table_name;
