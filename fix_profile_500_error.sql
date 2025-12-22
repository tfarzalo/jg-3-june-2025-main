-- Fix the HTTP 500 error when querying profiles
-- This error is likely caused by the new availability columns

-- 1. Check if there are any data validation issues with the new columns
SELECT 
    id,
    email,
    CASE 
        WHEN availability IS NULL THEN 'NULL - OK'
        WHEN jsonb_typeof(availability) = 'object' THEN 'Valid JSONB - OK'
        ELSE 'Invalid: ' || jsonb_typeof(availability) || ' - NEEDS FIX'
    END as availability_status,
    CASE 
        WHEN communication_preferences IS NULL THEN 'NULL - OK'
        WHEN jsonb_typeof(communication_preferences) = 'object' THEN 'Valid JSONB - OK'
        ELSE 'Invalid: ' || jsonb_typeof(communication_preferences) || ' - NEEDS FIX'
    END as comm_prefs_status,
    CASE 
        WHEN professional_info IS NULL THEN 'NULL - OK'
        WHEN jsonb_typeof(professional_info) = 'object' THEN 'Valid JSONB - OK'
        ELSE 'Invalid: ' || jsonb_typeof(professional_info) || ' - NEEDS FIX'
    END as prof_info_status
FROM profiles 
LIMIT 10;

-- 2. Check if there are any profiles with invalid JSONB data
SELECT 
    id,
    email,
    availability,
    communication_preferences,
    professional_info
FROM profiles 
WHERE 
    (availability IS NOT NULL AND jsonb_typeof(availability) != 'object')
    OR (communication_preferences IS NOT NULL AND jsonb_typeof(communication_preferences) != 'object')
    OR (professional_info IS NOT NULL AND jsonb_typeof(professional_info) != 'object');

-- 3. Check if the specific user ID from the error exists (without the :1 suffix)
-- The error shows: e73e8b31-1c9c-4b56-97be-d85dd30ca26d:1
-- The real UUID is: e73e8b31-1c9c-4b56-97be-d85dd30ca26d
SELECT 
    id,
    email,
    full_name,
    role,
    availability,
    communication_preferences,
    professional_info
FROM profiles 
WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- 4. Fix any profiles with NULL availability (set default values)
UPDATE profiles 
SET availability = '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb
WHERE availability IS NULL;

-- 5. Fix any profiles with NULL communication_preferences
UPDATE profiles 
SET communication_preferences = '{"email_notifications": true, "sms_notifications": false, "push_notifications": true}'::jsonb
WHERE communication_preferences IS NULL;

-- 6. Fix any profiles with NULL professional_info
UPDATE profiles 
SET professional_info = '{"skills": [], "certifications": [], "experience_years": 0, "specializations": []}'::jsonb
WHERE professional_info IS NULL;

-- 7. Check if there are any constraint violations
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'profiles'::regclass;

-- 8. Test the query that was failing (with correct UUID)
SELECT 
    id,
    email,
    full_name,
    role,
    availability,
    communication_preferences,
    professional_info
FROM profiles 
WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- 9. Check if there are any profiles with malformed IDs or data
SELECT 
    id,
    email,
    full_name,
    role,
    LENGTH(id::text) as id_length,
    CASE 
        WHEN id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'Valid UUID'
        ELSE 'Invalid UUID format'
    END as uuid_validation
FROM profiles 
LIMIT 5;
