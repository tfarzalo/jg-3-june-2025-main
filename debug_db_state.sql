-- Check function definitions
SELECT 
    p.proname, 
    pg_get_functiondef(p.oid) 
FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public' 
AND p.proname IN ('create_job_folder', 'create_property_folder', 'get_upload_folder');

-- Check triggers on jobs
SELECT 
    tgname, 
    pg_get_triggerdef(oid) 
FROM pg_trigger 
WHERE tgrelid = 'jobs'::regclass;

-- Check triggers on properties
SELECT 
    tgname, 
    pg_get_triggerdef(oid) 
FROM pg_trigger 
WHERE tgrelid = 'properties'::regclass;
