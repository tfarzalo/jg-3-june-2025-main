-- EMERGENCY COMPLETE FIX
-- This script will disable ALL triggers and identify the root cause
-- Fixed for PostgreSQL version compatibility

-- First, let's see what triggers exist across ALL tables
SELECT 
    n.nspname as schema_name,
    c.relname as table_name,
    t.tgname as trigger_name,
    t.tgtype as trigger_type
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY c.relname, t.tgname;

-- Disable ALL triggers on ALL tables in the public schema
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT 
            n.nspname as schema_name,
            c.relname as table_name,
            t.tgname as trigger_name
        FROM pg_trigger t
        JOIN pg_class c ON t.tgrelid = c.oid
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
        AND t.tgname NOT LIKE 'RI_ConstraintTrigger_%'  -- Skip system triggers
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I.%I DISABLE TRIGGER %I', 
                          r.schema_name, r.table_name, r.trigger_name);
            RAISE NOTICE 'Disabled trigger % on table %.%', r.trigger_name, r.schema_name, r.table_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not disable trigger % on table %.%: %', r.trigger_name, r.schema_name, r.table_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- Check if there are any functions that might be causing the :1 suffix issue
SELECT 
    p.proname as function_name,
    p.prosrc as function_source
FROM pg_proc p
WHERE p.prosrc LIKE '%:1%' 
   OR p.prosrc LIKE '%split%'
   OR p.prosrc LIKE '%substring%'
   OR p.prosrc LIKE '%position%';

-- Check for any views that might be adding the :1 suffix
SELECT 
    n.nspname as schema_name,
    c.relname as view_name
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relkind = 'v' 
  AND n.nspname = 'public';

-- Test if tables are now accessible
SELECT 'profiles' as table_name, COUNT(*) as row_count FROM profiles
UNION ALL
SELECT 'jobs' as table_name, COUNT(*) as row_count FROM jobs
UNION ALL
SELECT 'job_phases' as table_name, COUNT(*) as row_count FROM job_phases
UNION ALL
SELECT 'properties' as table_name, COUNT(*) as row_count FROM properties;

-- Test specific user profile access
SELECT id, email, full_name, role FROM profiles WHERE id = 'e73e8b31-1c9c-4b56-97be-d85dd30ca26d';

-- Check if there are any RLS policies still active
SELECT 
    n.nspname as schema_name,
    c.relname as table_name,
    pol.polname as policy_name,
    pol.polpermissive as permissive,
    pol.polroles as roles,
    pol.polcmd as cmd
FROM pg_policy pol
JOIN pg_class c ON pol.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname IN ('profiles', 'jobs', 'job_phases', 'properties');
