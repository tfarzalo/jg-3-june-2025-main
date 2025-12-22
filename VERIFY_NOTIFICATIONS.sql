-- Check if the test notification was created
SELECT 
  id,
  title,
  message,
  type,
  read,
  created_at,
  user_id
FROM user_notifications
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5;

-- Also check the count
SELECT COUNT(*) as total_notifications,
       COUNT(*) FILTER (WHERE read = false) as unread_count
FROM user_notifications
WHERE user_id = auth.uid();
