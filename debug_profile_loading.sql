-- Debug script to check why profiles are not loading
-- Run this to identify the issue

-- 1. Check if profiles table exists
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'profiles';

-- 2. Check current profiles table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 3. Check if there are any profiles in the table
SELECT COUNT(*) as total_profiles FROM profiles;

-- 4. Check sample profile data
SELECT 
    id,
    email,
    full_name,
    role,
    created_at
FROM profiles 
LIMIT 5;

-- 5. Check if the new availability column exists
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'availability';

-- 6. Check for any recent errors in the database
-- (This might not show much in Supabase, but worth checking)

-- 7. Test basic JSONB operations
SELECT 
    '{"test": true}'::jsonb as test_json;

-- 8. Check if there are any constraint violations
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass;

-- 9. Check RLS policies
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- 10. Check if there are any triggers that might be interfering
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgfoid::regproc as function_name,
    tgenabled as enabled
FROM pg_trigger 
WHERE tgrelid = 'profiles'::regclass;
