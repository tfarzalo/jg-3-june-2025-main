-- Direct notification creation test - bypasses all checks
-- This will INSERT directly to prove the system works

-- First, check your user ID and role
SELECT 
  id as my_user_id,
  full_name,
  email,
  role,
  notification_settings
FROM profiles
WHERE id = auth.uid();

-- Now insert a notification directly (bypassing send_notification function)
INSERT INTO user_notifications (
  id,
  user_id,
  title,
  message,
  type,
  read,
  created_at
) VALUES (
  gen_random_uuid(),
  auth.uid(),
  '🔔 Direct Test Notification',
  'This notification was inserted directly. If you see this in your bell icon, the frontend is working!',
  'system',
  false,
  NOW()
);

-- Verify it was created
SELECT 
  id,
  title,
  message,
  type,
  read,
  created_at
FROM user_notifications
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 1;
