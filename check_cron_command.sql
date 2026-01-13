-- Check the full cron job details including the command
SELECT 
  jobid,
  jobname, 
  schedule, 
  command,
  active,
  nodename,
  nodeport,
  database,
  username
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job';
