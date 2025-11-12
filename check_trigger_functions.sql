-- Check the trigger functions that might be causing issues
-- These triggers fire on every UPDATE to the profiles table

-- Check the update_last_seen_on_profile_update function
SELECT 
    proname as function_name,
    prosrc as function_source,
    proargtypes as argument_types
FROM pg_proc 
WHERE proname = 'update_last_seen_on_profile_update';

-- Check the update_profile_timestamp function
SELECT 
    proname as function_name,
    prosrc as function_source,
    proargtypes as argument_types
FROM pg_proc 
WHERE proname = 'update_profile_timestamp';

-- Check if these functions exist and are valid
SELECT 
    routine_name,
    routine_type,
    data_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name IN ('update_last_seen_on_profile_update', 'update_profile_timestamp');

-- Let's also check if there are any errors in the function definitions
-- by trying to call them manually (this might reveal the issue)
SELECT 'Checking trigger functions...' as status;

-- Check if the functions can be executed without errors
-- (This will help identify if they're the source of the 500 errors)
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_last_seen_on_profile_update') 
        THEN 'update_last_seen_on_profile_update exists'
        ELSE 'update_last_seen_on_profile_update missing'
    END as function_status_1,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_profile_timestamp') 
        THEN 'update_profile_timestamp exists'
        ELSE 'update_profile_timestamp missing'
    END as function_status_2;
