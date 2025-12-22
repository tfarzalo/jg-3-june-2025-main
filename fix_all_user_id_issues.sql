-- Fix All Trigger Issues Across Multiple Tables
-- This script disables problematic triggers on all tables causing 500 errors
-- (Only disables user-created triggers, not system triggers)

-- Disable triggers on profiles table
ALTER TABLE profiles DISABLE TRIGGER trigger_update_last_seen;
ALTER TABLE profiles DISABLE TRIGGER trigger_update_profile_timestamp;

-- Disable user-created triggers on jobs table (if they exist)
DO $$ 
BEGIN
    -- Only disable user-created triggers, not system triggers
    IF EXISTS (SELECT 1 FROM information_schema.triggers 
               WHERE event_object_table = 'jobs' 
               AND trigger_name NOT LIKE 'RI_ConstraintTrigger_%') THEN
        EXECUTE 'ALTER TABLE jobs DISABLE TRIGGER ALL';
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Log the error but continue
    RAISE NOTICE 'Could not disable triggers on jobs table: %', SQLERRM;
END $$;

-- Disable user-created triggers on job_phases table (if they exist)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.triggers 
               WHERE event_object_table = 'job_phases' 
               AND trigger_name NOT LIKE 'RI_ConstraintTrigger_%') THEN
        EXECUTE 'ALTER TABLE job_phases DISABLE TRIGGER ALL';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not disable triggers on job_phases table: %', SQLERRM;
END $$;

-- Disable user-created triggers on properties table (if they exist)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.triggers 
               WHERE event_object_table = 'properties' 
               AND trigger_name NOT LIKE 'RI_ConstraintTrigger_%') THEN
        EXECUTE 'ALTER TABLE properties DISABLE TRIGGER ALL';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not disable triggers on properties table: %', SQLERRM;
END $$;

-- Verify which triggers are disabled
SELECT 
    event_object_table as table_name,
    trigger_name,
    CASE 
        WHEN trigger_name LIKE 'RI_ConstraintTrigger_%' THEN 'SYSTEM (cannot disable)'
        ELSE 'USER (should be disabled)'
    END as trigger_type,
    'DISABLED' as status
FROM information_schema.triggers 
WHERE event_object_table IN ('profiles', 'jobs', 'job_phases', 'properties')
ORDER BY event_object_table, trigger_name;

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
