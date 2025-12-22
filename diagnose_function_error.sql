-- Diagnose the get_job_details error
-- Run this to see the actual error message

-- Test with a known job ID
SELECT get_job_details('cfe6b2d2-40c2-41fe-b34d-8fa46819793d'::uuid);

-- If that fails, check if the function exists
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_name = 'get_job_details';

-- Check if there's a syntax error in the function
SELECT 
    pg_get_functiondef('get_job_details(uuid)'::regprocedure);
