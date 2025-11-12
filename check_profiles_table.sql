-- Check the actual profiles table (not user_profiles)
-- This is the correct table we should be using

-- Check if profiles table exists and has data
SELECT COUNT(*) as profiles_count FROM profiles;

-- Check the structure of profiles table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- Check if there are any rows in profiles
SELECT * FROM profiles LIMIT 5;

-- Check if the specific user exists in profiles
SELECT * FROM profiles WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- Check auth.users to see what users exist
SELECT id, email, created_at FROM auth.users LIMIT 5;

-- Compare: how many users in auth.users vs profiles
SELECT 
    (SELECT COUNT(*) FROM auth.users) as auth_users_count,
    (SELECT COUNT(*) FROM profiles) as profiles_count;
