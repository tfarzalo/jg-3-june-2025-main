-- Find all functions that might validate file types
SELECT 
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prokind = 'f'  -- only functions, not aggregates
  AND pg_get_functiondef(p.oid) LIKE '%~%'
  AND (
    pg_get_functiondef(p.oid) ILIKE '%file%'
    OR pg_get_functiondef(p.oid) ILIKE '%type%'
    OR pg_get_functiondef(p.oid) ILIKE '%folder%'
  )
ORDER BY p.proname;
