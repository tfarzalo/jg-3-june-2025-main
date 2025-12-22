-- Identify the exact authentication issue
-- This will help us understand why profiles are not loading despite correct RLS policies

-- 1. Check if there are any profiles in the table
SELECT COUNT(*) as total_profiles FROM profiles;

-- 2. Look at sample profile data to understand the structure
SELECT 
    id,
    email,
    full_name,
    role,
    created_at
FROM profiles 
LIMIT 3;

-- 3. Check if there are any profiles with NULL or invalid IDs
SELECT 
    id,
    email,
    CASE 
        WHEN id IS NULL THEN 'NULL ID'
        WHEN id = '' THEN 'Empty ID'
        WHEN id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'Invalid UUID format'
        ELSE 'Valid UUID'
    END as id_status
FROM profiles 
LIMIT 5;

-- 4. Check if there are any profiles without email addresses
SELECT 
    id,
    email,
    full_name,
    role
FROM profiles 
WHERE email IS NULL OR email = '';

-- 5. Test the exact RLS policy logic
-- This simulates what happens when auth.uid() is called
SELECT 
    'Testing RLS logic' as test_type,
    COUNT(*) as profiles_with_valid_auth
FROM profiles 
WHERE auth.uid() IS NOT NULL;

-- 6. Check if there are any constraint violations
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass;

-- 7. Check if the new columns have any data validation issues
SELECT 
    id,
    email,
    CASE 
        WHEN availability IS NULL THEN 'NULL availability'
        WHEN jsonb_typeof(availability) = 'object' THEN 'Valid availability'
        ELSE 'Invalid availability: ' || jsonb_typeof(availability)
    END as availability_status,
    CASE 
        WHEN communication_preferences IS NULL THEN 'NULL comm_prefs'
        WHEN jsonb_typeof(communication_preferences) = 'object' THEN 'Valid comm_prefs'
        ELSE 'Invalid comm_prefs: ' || jsonb_typeof(communication_preferences)
    END as comm_prefs_status
FROM profiles 
LIMIT 5;

-- 8. Check if there are any triggers interfering with data access
SELECT 
    tgname as trigger_name,
    tgrelid::regclass as table_name,
    tgfoid::regproc as function_name,
    tgenabled as enabled
FROM pg_trigger 
WHERE tgrelid = 'profiles'::regclass
AND tgenabled = 'O';
