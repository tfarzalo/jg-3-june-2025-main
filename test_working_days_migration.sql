-- Test script for working_days migration
-- Run this to verify the migration works correctly

-- Check if profiles table exists
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'profiles';

-- Check current profiles table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- Check if working_days column exists
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'working_days';

-- Test JSONB operations
SELECT 
    '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb as test_json;

-- Check existing user roles
SELECT DISTINCT role FROM profiles;

-- Sample query to test working_days functionality
SELECT 
    id,
    email,
    role,
    working_days
FROM profiles 
WHERE role = 'subcontractor'
LIMIT 5;
