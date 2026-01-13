-- 1. Check Function Definition
SELECT pg_get_functiondef(oid) 
FROM pg_proc 
WHERE proname = 'create_job_folder';

-- 2. Check Triggers on Jobs
SELECT tgname, pg_get_triggerdef(oid) 
FROM pg_trigger 
WHERE tgrelid = 'jobs'::regclass;

-- 3. Check Recent Root Folders (Created today)
SELECT id, name, path, type, folder_id, created_at 
FROM files 
WHERE folder_id IS NULL 
ORDER BY created_at DESC 
LIMIT 10;

-- 4. Check Properties Folder
SELECT id, name, path, type, folder_id 
FROM files 
WHERE path = '/Properties';
