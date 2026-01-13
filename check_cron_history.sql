-- Check pg_cron job run history
-- This will show you when the job has run and whether it succeeded or failed

SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = 1
ORDER BY start_time DESC
LIMIT 20;

-- If you want to see just today's runs:
-- WHERE jobid = 1 AND start_time::date = CURRENT_DATE
