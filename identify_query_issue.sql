-- Identify the real issue causing the malformed UUID query
-- The error shows: e73e8b31-1c9c-4b56-97be-d85dd30ca26d:1 (extra :1)

-- 1. Check if the user ID exists (without the :1 suffix)
SELECT 
    'Checking if user exists' as test_type,
    id,
    email,
    full_name,
    role
FROM profiles 
WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- 2. Check if there are any profiles with similar IDs
SELECT 
    'Looking for similar IDs' as test_type,
    id,
    email,
    full_name,
    role
FROM profiles 
WHERE id::text LIKE 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d%';

-- 3. Check if there are any profiles with malformed IDs
SELECT 
    'Checking for malformed IDs' as test_type,
    id,
    email,
    full_name,
    role,
    LENGTH(id::text) as id_length
FROM profiles 
WHERE LENGTH(id::text) != 36;

-- 4. Check if the issue is with the new columns causing query failures
-- Test a simple query first
SELECT 
    'Testing basic query' as test_type,
    id,
    email,
    full_name,
    role
FROM profiles 
WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- 5. Then test with the new columns
SELECT 
    'Testing with new columns' as test_type,
    id,
    email,
    full_name,
    role,
    availability,
    preferred_contact_method,
    communication_preferences,
    professional_info
FROM profiles 
WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- 6. Check if there are any data type issues with the new columns
SELECT 
    'Checking data types' as test_type,
    id,
    email,
    CASE 
        WHEN availability IS NULL THEN 'NULL'
        WHEN jsonb_typeof(availability) = 'object' THEN 'Valid JSONB'
        ELSE 'Invalid: ' || jsonb_typeof(availability)
    END as availability_type,
    CASE 
        WHEN communication_preferences IS NULL THEN 'NULL'
        WHEN jsonb_typeof(communication_preferences) = 'object' THEN 'Valid JSONB'
        ELSE 'Invalid: ' || jsonb_typeof(communication_preferences)
    END as comm_prefs_type
FROM profiles 
WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- 7. Check if there are any constraint violations for this user
-- This might be causing the 500 error
SELECT 
    'Checking constraints' as test_type,
    conname as constraint_name,
    contype as constraint_type
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass;
