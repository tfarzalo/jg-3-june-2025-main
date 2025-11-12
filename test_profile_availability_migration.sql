-- Test script for profile availability migration
-- Run this to verify the migration works correctly

-- Check if profiles table exists and has the new columns
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN (
    'availability',
    'preferred_contact_method',
    'emergency_contact_name',
    'emergency_contact_phone',
    'emergency_contact_relationship',
    'address_line_1',
    'address_line_2',
    'city',
    'state',
    'zip_code',
    'country',
    'timezone',
    'language_preference',
    'communication_preferences',
    'professional_info',
    'social_media',
    'notes',
    'last_profile_update'
)
ORDER BY column_name;

-- Check if indexes were created
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'profiles' 
AND indexname LIKE '%availability%'
OR indexname LIKE '%communication%'
OR indexname LIKE '%professional%'
OR indexname LIKE '%social%';

-- Test JSONB operations with availability
SELECT 
    '{"monday": true, "tuesday": true, "wednesday": true, "thursday": true, "friday": true, "saturday": false, "sunday": false}'::jsonb as test_availability;

-- Test communication preferences
SELECT 
    '{"email_notifications": true, "sms_notifications": false, "push_notifications": true}'::jsonb as test_communication;

-- Test professional info
SELECT 
    '{"skills": ["Painting", "Drywall"], "certifications": ["OSHA"], "experience_years": 5, "specializations": ["Interior"]}'::jsonb as test_professional;

-- Test social media
SELECT 
    '{"linkedin": "https://linkedin.com/in/test", "website": "https://test.com", "other": null}'::jsonb as test_social;

-- Check if trigger function exists
SELECT 
    proname,
    prosrc
FROM pg_proc 
WHERE proname = 'update_profile_timestamp';

-- Check if trigger exists
SELECT 
    tgname,
    tgrelid::regclass as table_name,
    tgfoid::regproc as function_name
FROM pg_trigger 
WHERE tgname = 'trigger_update_profile_timestamp';

-- Test data insertion (if you have test data)
-- INSERT INTO profiles (id, email, full_name, role, availability) 
-- VALUES (
--     gen_random_uuid(),
--     'test@example.com',
--     'Test User',
--     'user',
--     '{"monday": true, "tuesday": false, "wednesday": true, "thursday": false, "friday": true, "saturday": false, "sunday": false}'::jsonb
-- );

-- Check existing user roles
SELECT DISTINCT role FROM profiles LIMIT 10;

-- Sample query to test availability functionality
SELECT 
    id,
    email,
    role,
    availability,
    preferred_contact_method,
    timezone
FROM profiles 
WHERE availability IS NOT NULL
LIMIT 5;
