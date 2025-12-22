-- Check RLS policies that might be blocking profile access
-- This is likely the root cause of the profile loading issue

-- 1. Check all RLS policies on the profiles table
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;

-- 2. Check if RLS is enabled on the profiles table
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'profiles';

-- 3. Check the specific policy that should allow users to read their own profile
-- This policy should exist: "Users can read own availability" or similar
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'profiles' 
AND cmd = 'SELECT'
AND (qual LIKE '%auth.uid()%' OR qual LIKE '%auth.uid() = id%');

-- 4. Check if there are any policies that might be too restrictive
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'profiles' 
AND (qual LIKE '%false%' OR qual LIKE '%auth.uid() IS NULL%');

-- 5. Test what happens when we simulate an authenticated user query
-- This will help identify if the issue is with RLS or data
SELECT 
    'Testing RLS simulation' as test_type,
    COUNT(*) as accessible_profiles
FROM profiles 
WHERE auth.uid() IS NOT NULL;

-- 6. Check if there are any conflicting policies
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'profiles' 
AND cmd = 'SELECT'
ORDER BY policyname;
