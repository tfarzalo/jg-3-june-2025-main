-- Simple fix script for profile loading issue
-- No complex validation that could cause errors

-- 1. Check if the user exists (without the :1 suffix)
SELECT 
    'Checking if user exists' as test_type,
    id,
    email,
    full_name,
    role
FROM profiles 
WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- 2. Check if there are any profiles with NULL values in new columns
SELECT 
    'Checking for NULL values' as test_type,
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN availability IS NULL THEN 1 END) as null_availability,
    COUNT(CASE WHEN communication_preferences IS NULL THEN 1 END) as null_comm_prefs,
    COUNT(CASE WHEN professional_info IS NULL THEN 1 END) as null_prof_info
FROM profiles;

-- 3. Fix any profiles with NULL availability
UPDATE profiles 
SET availability = '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb
WHERE availability IS NULL;

-- 4. Fix any profiles with NULL communication_preferences
UPDATE profiles 
SET communication_preferences = '{"email_notifications": true, "sms_notifications": false, "push_notifications": true}'::jsonb
WHERE communication_preferences IS NULL;

-- 5. Fix any profiles with NULL professional_info
UPDATE profiles 
SET professional_info = '{"skills": [], "certifications": [], "experience_years": 0, "specializations": []}'::jsonb
WHERE professional_info IS NULL;

-- 6. Test the query that was failing (with correct UUID)
SELECT 
    'Testing fixed query' as test_type,
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

-- 7. Verify the fix worked
SELECT 
    'Verification' as test_type,
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN availability IS NOT NULL THEN 1 END) as profiles_with_availability,
    COUNT(CASE WHEN communication_preferences IS NOT NULL THEN 1 END) as profiles_with_comm_prefs,
    COUNT(CASE WHEN professional_info IS NOT NULL THEN 1 END) as profiles_with_prof_info
FROM profiles;
