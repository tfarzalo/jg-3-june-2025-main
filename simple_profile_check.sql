-- Simple profile check - no complex validation that could cause errors
-- This will help us identify the basic issue

-- 1. Check if there are any profiles in the table
SELECT COUNT(*) as total_profiles FROM profiles;

-- 2. Look at sample profile data (basic columns only)
SELECT 
    id,
    email,
    full_name,
    role,
    created_at
FROM profiles 
LIMIT 3;

-- 3. Check if the new availability columns exist and have data
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('availability', 'preferred_contact_method', 'communication_preferences')
ORDER BY column_name;

-- 4. Test basic data access (no complex queries)
SELECT 
    id,
    email,
    full_name,
    role
FROM profiles 
WHERE id IS NOT NULL
LIMIT 1;

-- 5. Check if there are any obvious data issues
SELECT 
    'Basic data check' as test_type,
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN email IS NULL THEN 1 END) as profiles_without_email,
    COUNT(CASE WHEN full_name IS NULL THEN 1 END) as profiles_without_name,
    COUNT(CASE WHEN role IS NULL THEN 1 END) as profiles_without_role
FROM profiles;

-- 6. Test JSONB column access (simple test)
SELECT 
    id,
    email,
    CASE 
        WHEN availability IS NULL THEN 'NULL'
        ELSE 'Has data'
    END as availability_status
FROM profiles 
LIMIT 3;
