-- Quick profile check to diagnose loading issues
-- Run these queries one by one to identify the problem

-- 1. Check if profiles table has data
SELECT COUNT(*) as total_profiles FROM profiles;

-- 2. Check current table structure (what columns exist)
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 3. Check if availability column exists
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'availability';

-- 4. Check sample profile data (first few rows)
SELECT 
    id,
    email,
    full_name,
    role,
    created_at
FROM profiles 
LIMIT 3;

-- 5. Check RLS policies
SELECT 
    policyname,
    permissive,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'profiles';

-- 6. Test basic JSONB operations
SELECT 
    '{"test": true}'::jsonb as test_json;

-- 7. Check current user and database
SELECT 
    current_user,
    current_database(),
    session_user;
