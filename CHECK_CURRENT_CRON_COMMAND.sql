-- =====================================================
-- Check what the current cron job is actually running
-- =====================================================

SELECT 
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job';
