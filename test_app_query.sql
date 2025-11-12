-- Test the exact query that the app is trying to run
-- This will help identify why profiles are not loading

-- 1. First, let's see what profiles exist
SELECT 
    id,
    email,
    full_name,
    role,
    created_at
FROM profiles 
LIMIT 5;

-- 2. Test the exact query pattern the app uses
-- The app does: SELECT * FROM profiles WHERE id = 'user-id' LIMIT 1
-- Let's test with a real user ID from step 1
-- Replace 'REPLACE_WITH_ACTUAL_USER_ID' with a real ID from step 1

-- Example (uncomment and modify):
-- SELECT * FROM profiles WHERE id = 'REPLACE_WITH_ACTUAL_USER_ID' LIMIT 1;

-- 3. Test if the new columns are causing issues
-- Try selecting just the basic columns first
SELECT 
    id,
    email,
    full_name,
    role,
    avatar_url,
    nickname,
    mobile_phone,
    sms_phone,
    bio,
    username,
    theme_preference,
    work_schedule,
    notification_settings
FROM profiles 
LIMIT 1;

-- 4. Then try including the new availability columns
SELECT 
    id,
    email,
    full_name,
    role,
    availability,
    preferred_contact_method,
    communication_preferences,
    professional_info
FROM profiles 
LIMIT 1;

-- 5. Check if there are any data type issues with the new columns
SELECT 
    id,
    email,
    availability,
    CASE 
        WHEN availability IS NULL THEN 'NULL'
        WHEN jsonb_typeof(availability) = 'object' THEN 'Valid JSONB'
        ELSE 'Invalid: ' || jsonb_typeof(availability)
    END as availability_status
FROM profiles 
LIMIT 3;

-- 6. Test JSONB operations on the new columns
SELECT 
    id,
    email,
    availability->>'monday' as monday_available,
    communication_preferences->>'email_notifications' as email_enabled
FROM profiles 
WHERE availability IS NOT NULL
LIMIT 3;
