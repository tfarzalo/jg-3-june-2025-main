-- Find ALL constraints with regex patterns in the entire database
SELECT 
    n.nspname AS schema_name,
    t.relname AS table_name,
    c.conname AS constraint_name,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE pg_get_constraintdef(c.oid) LIKE '%~%'
ORDER BY n.nspname, t.relname, c.conname;
