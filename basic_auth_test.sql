-- Basic authentication test - simple and safe
-- This will help identify if the issue is with browser auth

-- 1. Check current connection (you're postgres, bypassing RLS)
SELECT 
    current_user,
    current_database(),
    'You are connected as postgres (bypassing RLS)' as note;

-- 2. Check if profiles table has any data at all
SELECT 
    'Basic table check' as test_type,
    COUNT(*) as total_profiles
FROM profiles;

-- 3. Check if we can see any profile data
SELECT 
    'Sample data check' as test_type,
    id,
    email,
    full_name,
    role
FROM profiles 
LIMIT 2;

-- 4. Check if the new columns exist
SELECT 
    'New columns check' as test_type,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('availability', 'preferred_contact_method')
ORDER BY column_name;

-- 5. Simple test of the new columns
SELECT 
    'New columns test' as test_type,
    id,
    email,
    availability,
    preferred_contact_method
FROM profiles 
LIMIT 2;
