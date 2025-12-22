-- Temporarily disable problematic triggers to test if they're causing 500 errors
-- This will help us identify if the triggers are the root cause

-- Disable the triggers temporarily
ALTER TABLE profiles DISABLE TRIGGER trigger_update_last_seen;
ALTER TABLE profiles DISABLE TRIGGER trigger_update_profile_timestamp;

-- Verify triggers are disabled
SELECT 
    trigger_name,
    event_manipulation,
    action_statement,
    'DISABLED' as status
FROM information_schema.triggers 
WHERE event_object_table = 'profiles';

-- Test if we can now access profiles without errors
SELECT COUNT(*) as profiles_accessible FROM profiles;

-- Test the specific user profile
SELECT id, email, full_name, role FROM profiles WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- If this works, the triggers were the problem!
-- We can then fix the trigger functions and re-enable them
