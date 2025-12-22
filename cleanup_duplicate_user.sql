-- Check for the user with the duplicate email
-- Replace 'user@example.com' with the actual email you tried to create

-- Step 1: Find the user in profiles
SELECT id, email, full_name, role, created_at 
FROM profiles 
WHERE email = 'user@example.com';  -- Replace with actual email

-- Step 2: Check if there's a matching auth user
-- (Run this in the Supabase Dashboard under Authentication > Users)
-- Look for the email in the auth.users table

-- Step 3: If you want to delete the orphaned profile (CAUTION!)
-- Uncomment and run this only if you're sure:
-- DELETE FROM profiles WHERE email = 'user@example.com';  -- Replace with actual email

-- Step 4: If there's an auth user but no complete profile, you might need to:
-- Option A: Delete the auth user from the Supabase Dashboard (Authentication > Users)
-- Option B: Complete the profile creation manually:
/*
UPDATE profiles 
SET 
  full_name = 'Full Name',
  role = 'subcontractor',
  working_days = '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": true}'::jsonb
WHERE email = 'user@example.com';  -- Replace with actual email
*/
