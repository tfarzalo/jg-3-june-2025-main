-- =====================================================
-- DIAGNOSTIC: Find correct user_notifications columns
-- =====================================================

-- 1. Show ALL columns in user_notifications
SELECT 
  'All columns' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_notifications'
ORDER BY ordinal_position;

-- 2. Look for any column that might indicate "read" status
SELECT 
  'Columns containing read/status/viewed' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'user_notifications'
  AND (
    column_name ILIKE '%read%'
    OR column_name ILIKE '%status%'
    OR column_name ILIKE '%view%'
    OR column_name ILIKE '%seen%'
  );

-- 3. Check if process_approval_token actually works
-- (If it works, the column must exist or function is different)
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_name = 'process_approval_token';
