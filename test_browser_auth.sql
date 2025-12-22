-- Test browser authentication vs database access
-- This will help identify if the issue is in the browser or database

-- 1. Check current authentication context
SELECT 
    current_user,
    current_database(),
    session_user,
    'You are connected as postgres (bypassing RLS)' as note;

-- 2. Simulate what happens when a regular user tries to access profiles
-- This will show us if the RLS policies work correctly
SELECT 
    'Simulating regular user access' as test_type,
    COUNT(*) as accessible_profiles
FROM profiles 
WHERE auth.uid() IS NOT NULL;

-- 3. Check if there are any profiles that would be accessible to a user
-- (This simulates the RLS policy: auth.uid() = id)
SELECT 
    'Profiles accessible to users' as test_type,
    COUNT(*) as user_accessible_profiles
FROM profiles 
WHERE id IS NOT NULL;

-- 4. Test the exact query the app uses
-- The app does: SELECT * FROM profiles WHERE id = 'user-id' LIMIT 1
-- Let's see if we can find any profiles that would match this pattern
SELECT 
    'Testing app query pattern' as test_type,
    id,
    email,
    full_name,
    role
FROM profiles 
WHERE id IS NOT NULL
LIMIT 3;

-- 5. Check if the issue might be with the new columns
-- Try selecting just the basic columns to see if that works
SELECT 
    'Testing basic columns only' as test_type,
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

-- 6. Then try with the new availability columns
SELECT 
    'Testing with new availability columns' as test_type,
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

-- 7. Check if there are any data type conversion issues
SELECT 
    'Checking data types' as test_type,
    id,
    email,
    CASE 
        WHEN availability IS NULL THEN 'NULL'
        WHEN jsonb_typeof(availability) = 'object' THEN 'Valid JSONB'
        ELSE 'Invalid: ' || jsonb_typeof(availability)
    END as availability_type,
    CASE 
        WHEN communication_preferences IS NULL THEN 'NULL'
        WHEN jsonb_typeof(communication_preferences) = 'object' THEN 'Valid JSONB'
        ELSE 'Invalid: ' || jsonb_typeof(communication_preferences)
    END as comm_prefs_type
FROM profiles 
LIMIT 3;
