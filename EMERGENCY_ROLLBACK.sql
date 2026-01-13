-- EMERGENCY ROLLBACK - Restore v8 immediately
-- Copy everything from apply_get_job_details_fix_v8.sql

DROP FUNCTION IF EXISTS get_job_details(UUID);

-- This will restore the working version
-- After running this, copy and paste the entire contents of:
-- apply_get_job_details_fix_v8.sql

-- OR if you have access to that file, just run it directly:
-- \i apply_get_job_details_fix_v8.sql
