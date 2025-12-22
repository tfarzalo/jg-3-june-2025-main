-- Profile Loading Diagnosis Script
-- Run this to identify the specific issue

-- 1. Check if there are any profiles in the table
SELECT COUNT(*) as total_profiles FROM profiles;

-- 2. Check if the availability column exists and has data
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('availability', 'preferred_contact_method', 'emergency_contact_name');

-- 3. Check sample profile data structure
SELECT 
    id,
    email,
    full_name,
    role,
    availability,
    preferred_contact_method,
    created_at
FROM profiles 
LIMIT 3;

-- 4. Check RLS policies (this is critical for profile loading)
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- 5. Check if there are any constraint violations
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass;

-- 6. Test a simple profile query (simulate what the app does)
-- Replace 'your-actual-user-id' with a real user ID from step 3
-- SELECT * FROM profiles WHERE id = 'your-actual-user-id';

-- 7. Check if the new columns have default values
SELECT 
    column_name,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('availability', 'communication_preferences', 'professional_info');

-- 8. Check for any recent errors or issues
-- This might not show much in Supabase, but worth checking
