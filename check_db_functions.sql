SELECT 
    p.proname, 
    pg_get_functiondef(p.oid) 
FROM pg_proc p 
JOIN pg_namespace n ON p.pronamespace = n.oid 
WHERE n.nspname = 'public' 
AND p.proname IN ('create_job_folder', 'create_property_folder', 'ensure_property_folders_exist', 'get_upload_folder');
