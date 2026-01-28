-- Quick fix: Enable yourself for daily emails
-- Replace YOUR_USER_ID with your actual user ID from profiles table

-- Step 1: Find your user ID
SELECT 
  'Your user ID:' as step,
  id,
  email
FROM profiles 
WHERE email LIKE '%@%'  -- Shows all users
ORDER BY created_at DESC;

-- Step 2: Check if you have a settings row
SELECT 
  'Your current setting:' as step,
  user_id,
  enabled
FROM daily_email_settings
WHERE user_id IN (SELECT id FROM profiles LIMIT 5);

-- Step 3: If no row exists, you need to create one via the UI
-- Go to: Settings → Daily Agenda Email Settings
-- Toggle yourself ON

-- Step 4: Verify emails are enabled
SELECT 
  'Users with emails enabled:' as step,
  p.email,
  des.enabled
FROM daily_email_settings des
JOIN profiles p ON p.id = des.user_id
WHERE des.enabled = true;
