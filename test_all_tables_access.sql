-- Test if all previously failing tables are now accessible
-- This will confirm that disabling triggers fixed the 500 errors

-- Test profiles table (should work now)
SELECT 'profiles' as table_name, COUNT(*) as row_count FROM profiles;

-- Test jobs table
SELECT 'jobs' as table_name, COUNT(*) as row_count FROM jobs;

-- Test job_phases table
SELECT 'job_phases' as table_name, COUNT(*) as row_count FROM job_phases;

-- Test properties table
SELECT 'properties' as table_name, COUNT(*) as row_count FROM properties;

-- Test a few sample rows from each table to ensure they're fully accessible
SELECT 'profiles sample' as info, id, email, full_name, role FROM profiles LIMIT 3;

SELECT 'jobs sample' as info, id, work_order_num, unit_number, scheduled_date FROM jobs LIMIT 3;

SELECT 'job_phases sample' as info, id, job_phase_label FROM job_phases LIMIT 3;

SELECT 'properties sample' as info, id, property_name, address FROM properties LIMIT 3;

-- If all these queries work, the trigger issues are resolved!
