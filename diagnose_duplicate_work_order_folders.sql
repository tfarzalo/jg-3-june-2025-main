-- Check for all triggers and functions that create work order folders
-- This will help identify which one is creating the duplicate without padding

-- Check all active triggers on relevant tables
SELECT 
    t.tgname AS trigger_name,
    c.relname AS table_name,
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('jobs', 'work_orders')
    AND t.tgname LIKE '%folder%'
ORDER BY c.relname, t.tgname;

-- Check all functions that might create work order folders
SELECT 
    proname AS function_name,
    prosrc AS source_code
FROM pg_proc
WHERE proname LIKE '%work_order%folder%'
    OR proname LIKE '%create%folder%'
ORDER BY proname;

-- Find all work order folders WITHOUT proper padding
SELECT 
    id,
    name,
    path,
    job_id,
    created_at
FROM files
WHERE type = 'folder/directory'
    AND name LIKE 'WO-%'
    AND LENGTH(SUBSTRING(name FROM 'WO-(.*)')) < 6
ORDER BY created_at DESC;

-- Find work orders with both padded and unpadded folders
SELECT 
    j.work_order_num,
    j.id as job_id,
    STRING_AGG(DISTINCT f.name, ', ') as folder_names,
    STRING_AGG(DISTINCT f.path, ', ') as paths,
    COUNT(f.id) as folder_count
FROM jobs j
LEFT JOIN files f ON f.job_id = j.id 
    AND f.type = 'folder/directory'
    AND f.name LIKE 'WO-%'
GROUP BY j.work_order_num, j.id
HAVING COUNT(f.id) > 1
ORDER BY j.work_order_num;
