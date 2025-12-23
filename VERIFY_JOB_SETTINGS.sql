-- =====================================================
-- VERIFY JOB SETTINGS & LOGS
-- =====================================================
-- Run this script to ensure the job was saved with the CORRECT keys
-- and to check for any execution errors.
-- =====================================================

-- 1. INSPECT THE SAVED COMMAND
-- Check the 'command' column below. 
-- ⚠️ IF YOU SEE "[YOUR_PROJECT_REF]" or "[YOUR_SERVICE_ROLE_KEY]", IT WAS NOT SAVED CORRECTLY.
-- It should look like: https://abcde...supabase.co/functions...
SELECT 
  jobid, 
  jobname, 
  command 
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job';

-- 2. CHECK EXECUTION LOGS
-- This shows the history of the job running.
-- If 'status' is 'failed', check the 'return_message'.
SELECT 
  runid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-agenda-email-job') 
ORDER BY start_time DESC 
LIMIT 5;
