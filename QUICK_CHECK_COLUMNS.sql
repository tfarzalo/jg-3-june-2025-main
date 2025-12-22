-- Quick check: What columns does user_notifications have?
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'user_notifications'
  AND table_schema = 'public'
ORDER BY ordinal_position;
