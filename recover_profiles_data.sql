-- Recover Profiles Data
-- This script recreates the profiles that were lost

-- First, let's check what we have
SELECT COUNT(*) FROM profiles;
SELECT * FROM profiles LIMIT 5;

-- Check if the auth.users table still has users
SELECT id, email, created_at FROM auth.users LIMIT 5;

-- Recreate the missing profile for the current user
INSERT INTO profiles (
    id,
    email,
    full_name,
    role,
    theme_preference,
    work_schedule,
    notification_settings,
    working_days,
    availability,
    communication_preferences,
    professional_info,
    social_media,
    created_at,
    updated_at
) VALUES (
    'e73e8b31-1c9c-4b56-97be-d85dd30ca26d',
    'user@example.com', -- Replace with actual email
    'Test User',
    'user',
    'dark',
    ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    '{"job_phase_changes": true, "work_orders": true, "callbacks": true, "system_alerts": true}',
    '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}',
    '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}',
    '{"email": true, "sms": false, "push": true}',
    '{"company": "", "position": "", "department": "", "employee_id": ""}',
    '{"linkedin": "", "twitter": "", "facebook": ""}',
    NOW(),
    NOW()
) ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();

-- Check if the profile was created
SELECT * FROM profiles WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- Now let's recreate profiles for any other users in auth.users
-- This will create basic profiles for all authenticated users
INSERT INTO profiles (
    id,
    email,
    full_name,
    role,
    theme_preference,
    work_schedule,
    notification_settings,
    working_days,
    availability,
    communication_preferences,
    professional_info,
    social_media,
    created_at,
    updated_at
)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'full_name', 'User'),
    'user',
    'dark',
    ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    '{"job_phase_changes": true, "work_orders": true, "callbacks": true, "system_alerts": true}',
    '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}',
    '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}',
    '{"email": true, "sms": false, "push": true}',
    '{"company": "", "position": "", "department": "", "employee_id": ""}',
    '{"linkedin": "", "twitter": "", "facebook": ""}',
    au.created_at,
    NOW()
FROM auth.users au
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = au.id
);

-- Check final count
SELECT COUNT(*) as total_profiles FROM profiles;
SELECT id, email, full_name, role FROM profiles LIMIT 10;
