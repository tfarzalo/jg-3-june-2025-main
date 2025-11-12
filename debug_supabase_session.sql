-- Debug Supabase Session and Authentication
-- This will help us understand why the app can't access profiles even though SQL can

-- Check if there are any active sessions
SELECT 
    id,
    user_id,
    created_at,
    not_after,
    refreshed_at
FROM auth.sessions 
WHERE user_id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- Check the specific user's auth state
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_user_meta_data,
    raw_app_meta_data
FROM auth.users 
WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- Check if there are any RLS policies still active (even though we disabled them)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- Check if RLS is actually disabled on the profiles table
-- (Using a different approach that's compatible with older PostgreSQL versions)
SELECT 
    schemaname,
    tablename
FROM pg_tables 
WHERE tablename = 'profiles';

-- Test if we can access the profile as the specific user
-- (This simulates what the app is trying to do)
SELECT 
    'RLS Status Check' as check_type,
    COUNT(*) as accessible_profiles
FROM profiles 
WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- Additional check: try to see if there are any triggers that might be interfering
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'profiles';
