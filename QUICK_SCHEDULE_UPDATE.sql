-- =====================================================
-- QUICK FIX: Update Existing Cron Job Schedule
-- =====================================================
-- Use this if you just want to update the time without 
-- rebuilding everything. This changes the schedule to
-- 7:00 AM ET / 4:00 AM PT (12:00 UTC).
-- =====================================================

-- Option 1: Update schedule only (if job is already correct)
SELECT cron.alter_job(
  2,  -- jobid from your system
  schedule := '0 12 * * *'  -- 7:00 AM ET / 4:00 AM PT
);

-- Verify the change
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  command
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job';

-- =====================================================
-- Option 2: Complete rebuild (if job needs HTTP fix too)
-- =====================================================
-- Run the full FIX_DAILY_AGENDA_CRON_JOB.sql instead
-- =====================================================
