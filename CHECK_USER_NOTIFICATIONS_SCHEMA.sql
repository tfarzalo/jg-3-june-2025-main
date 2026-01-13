-- =====================================================
-- CHECK: user_notifications table structure
-- =====================================================

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_notifications'
ORDER BY ordinal_position;

-- This will show us the exact column names
