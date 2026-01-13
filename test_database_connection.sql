-- Simple database connection test
-- Run this to verify basic database functionality

-- 1. Test basic connection
SELECT version();

-- 2. Test if we can query the profiles table
SELECT COUNT(*) as profile_count FROM profiles;

-- 3. Test if we can see table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
LIMIT 10;

-- 4. Test basic JSONB operations
SELECT 
    '{"test": true}'::jsonb as test_json,
    '{"monday": true, "tuesday": false}'::jsonb as test_availability;

-- 5. Test if we can insert a test record (optional)
-- INSERT INTO profiles (id, email, full_name, role) 
-- VALUES (gen_random_uuid(), 'test@test.com', 'Test User', 'user')
-- ON CONFLICT DO NOTHING;

-- 6. Check current user authentication
SELECT current_user, current_database();

-- 7. Test RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'profiles';
