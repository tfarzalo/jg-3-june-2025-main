-- =====================================================
-- Daily Agenda Email Cron Diagnostic and Fix
-- =====================================================
-- This script will diagnose and fix the cron job issue
-- Run each section in Supabase SQL Editor
-- =====================================================

-- PART 1: DIAGNOSTIC - Check current state
-- =====================================================

-- 1. Check if pg_cron extension is enabled
SELECT 
  extname, 
  extversion
FROM pg_extension 
WHERE extname IN ('pg_cron', 'pg_net');

-- 2. Check if pg_net extension is enabled (needed to call Edge Functions)
-- If pg_net is not listed above, it needs to be enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 3. Check current cron jobs
SELECT 
  jobid,
  jobname, 
  schedule, 
  command,
  active,
  database
FROM cron.job 
WHERE jobname LIKE '%daily%' OR jobname LIKE '%email%' OR jobname LIKE '%agenda%';

-- 4. Check cron job run history (last 10 runs)
SELECT 
  job.jobname,
  run.runid,
  run.job_pid,
  run.database,
  run.username,
  run.command,
  run.status,
  run.return_message,
  run.start_time,
  run.end_time
FROM cron.job_run_details run
LEFT JOIN cron.job job ON run.jobid = job.jobid
WHERE job.jobname LIKE '%daily%' OR job.jobname LIKE '%email%' OR job.jobname LIKE '%agenda%'
ORDER BY run.start_time DESC
LIMIT 10;

-- 5. Check email send log (if table exists)
SELECT 
  sent_at,
  recipients,
  job_count,
  success,
  error_message,
  triggered_by
FROM daily_email_send_log
ORDER BY sent_at DESC
LIMIT 10;

-- 6. Check daily_email_settings table
SELECT 
  id,
  enabled,
  send_time,
  recipient_profile_ids,
  created_at,
  updated_at
FROM daily_email_settings
ORDER BY created_at DESC
LIMIT 1;

-- 7. Check if we have the user role data needed
SELECT DISTINCT role 
FROM users 
WHERE role IS NOT NULL 
ORDER BY role;

-- PART 2: FIX - Remove old cron job and create new one
-- =====================================================

-- 1. Remove ALL existing daily email cron jobs (clean slate)
DO $$
DECLARE
  job_rec RECORD;
BEGIN
  FOR job_rec IN 
    SELECT jobname FROM cron.job 
    WHERE jobname LIKE '%daily%' 
       OR jobname LIKE '%email%' 
       OR jobname LIKE '%agenda%'
  LOOP
    RAISE NOTICE 'Unscheduling job: %', job_rec.jobname;
    PERFORM cron.unschedule(job_rec.jobname);
  END LOOP;
END $$;

-- 2. Create the NEW cron job that actually calls the Edge Function
-- This uses net.http_post to invoke the send-daily-agenda-email Edge Function
-- Scheduled to run at 9:00 AM UTC (5:00 AM ET) Monday-Friday
SELECT cron.schedule(
  'daily-agenda-email-job',
  '0 9 * * 1-5', -- 9:00 AM UTC = 5:00 AM ET (Monday-Friday)
  $$
  SELECT net.http_post(
    url := 'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRid3RmaW1uYm12Ymdlc2lkYnhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDEyOTA3OSwiZXhwIjoyMDY1NzA1MDc5fQ.6H9yeEtrq_kf8DkrQXSHCHlo-erE_gso715qAwsDKmU',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'action', 'send_daily_email',
      'manual', false
    )
  ) AS request_id;
  $$
);

-- 3. Verify the new job was created
SELECT 
  jobid,
  jobname, 
  schedule, 
  command,
  active,
  database,
  nodename
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job';

-- PART 3: TESTING
-- =====================================================

-- Test the cron command manually (this will send the email NOW)
-- Comment this out if you don't want to send a test email immediately
/*
SELECT net.http_post(
  url := 'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email',
  headers := jsonb_build_object(
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRid3RmaW1uYm12Ymdlc2lkYnhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDEyOTA3OSwiZXhwIjoyMDY1NzA1MDc5fQ.6H9yeEtrq_kf8DkrQXSHCHlo-erE_gso715qAwsDKmU',
    'Content-Type', 'application/json'
  ),
  body := jsonb_build_object(
    'action', 'send_daily_email',
    'manual', false
  )
) AS request_id;
*/

-- PART 4: MONITORING
-- =====================================================

-- Check cron execution in the next few minutes
-- Run this query after the scheduled time to see if it executed
SELECT 
  job.jobname,
  run.status,
  run.return_message,
  run.start_time,
  run.end_time
FROM cron.job_run_details run
LEFT JOIN cron.job job ON run.jobid = job.jobid
WHERE job.jobname = 'daily-agenda-email-job'
ORDER BY run.start_time DESC
LIMIT 5;

-- Check the email send log
SELECT 
  sent_at,
  recipients,
  job_count,
  success,
  error_message,
  triggered_by
FROM daily_email_send_log
ORDER BY sent_at DESC
LIMIT 5;

-- =====================================================
-- NOTES
-- =====================================================
-- 1. The cron job is scheduled for 9:00 AM UTC = 5:00 AM ET
-- 2. It runs Monday-Friday (1-5 in cron syntax)
-- 3. The Edge Function will check daily_agenda_email_settings 
--    and only send if enabled=true
-- 4. The cron job uses net.http_post to call the Edge Function
-- 5. The service role key is embedded in the Authorization header
-- 6. Monitor the cron.job_run_details table to see execution history
-- =====================================================
