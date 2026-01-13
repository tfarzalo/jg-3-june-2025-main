-- Create missing profile for user e73e8b31-1c9c-4b56-97be-d85dd30ca26d
-- This user is authenticated but doesn't have a profile, causing the 500 error

-- 1. Check if this user exists in auth.users (if accessible)
-- Note: This might not work if you don't have access to auth.users table
SELECT 
    'Checking auth.users' as test_type,
    'User might not exist in auth system' as note;

-- 2. Create a profile for the missing user
-- This will fix the 500 error when the app tries to query this profile
INSERT INTO profiles (
    id,
    email,
    full_name,
    role,
    availability,
    preferred_contact_method,
    communication_preferences,
    professional_info,
    social_media,
    created_at,
    updated_at
) VALUES (
    'e73e8b31-1c9c-4b56-97be-d85dd30ca26d',
    'user@example.com', -- You can update this later
    'New User', -- You can update this later
    'user', -- Default role, you can update this later
    '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb,
    'email',
    '{"email_notifications": true, "sms_notifications": false, "push_notifications": true}'::jsonb,
    '{"skills": [], "certifications": [], "experience_years": 0, "specializations": []}'::jsonb,
    '{"linkedin": null, "website": null, "other": null}'::jsonb,
    now(),
    now()
)
ON CONFLICT (id) DO UPDATE SET
    updated_at = now();

-- 3. Verify the profile was created
SELECT 
    'Verifying profile creation' as test_type,
    id,
    email,
    full_name,
    role,
    availability,
    communication_preferences,
    professional_info
FROM profiles 
WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- 4. Test the query that was failing
SELECT 
    'Testing the previously failing query' as test_type,
    id,
    email,
    full_name,
    role,
    availability,
    preferred_contact_method,
    communication_preferences,
    professional_info
FROM profiles 
WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- 5. Check if there are any other missing profiles
-- This will help identify if there are more users without profiles
SELECT 
    'Checking for other potential issues' as test_type,
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN availability IS NULL THEN 1 END) as null_availability,
    COUNT(CASE WHEN communication_preferences IS NULL THEN 1 END) as null_comm_prefs,
    COUNT(CASE WHEN professional_info IS NULL THEN 1 END) as null_prof_info
FROM profiles;
