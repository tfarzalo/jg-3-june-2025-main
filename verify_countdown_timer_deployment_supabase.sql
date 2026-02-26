-- =====================================================
-- COUNTDOWN TIMER FEATURE - PRODUCTION VERIFICATION
-- Run this in Supabase SQL Editor
-- Date: February 26, 2026
-- =====================================================

-- =====================================================
-- 1. CHECK DATABASE COLUMNS
-- =====================================================
SELECT 
  'Database Columns Check' as check_type,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'assignment_deadline'
  ) as has_assignment_deadline,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'assigned_at'
  ) as has_assigned_at,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'assignment_status'
  ) as has_assignment_status;

-- =====================================================
-- 2. CHECK DATABASE FUNCTIONS
-- =====================================================
SELECT 
  'Database Functions Check' as check_type,
  EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'calculate_assignment_deadline'
  ) as has_calculate_deadline,
  EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'assign_job_to_subcontractor'
  ) as has_assign_function,
  EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'accept_job_assignment'
  ) as has_accept_function,
  EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'decline_job_assignment'
  ) as has_decline_function,
  EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'auto_decline_expired_assignments'
  ) as has_auto_decline_function;

-- =====================================================
-- 3. CHECK INDEXES
-- =====================================================
SELECT 
  'Database Indexes Check' as check_type,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'jobs'
  AND indexname LIKE '%assignment%'
ORDER BY indexname;

-- =====================================================
-- 4. CHECK PENDING JOBS WITH DEADLINES
-- =====================================================
SELECT 
  'Pending Jobs Check' as check_type,
  COUNT(*) as total_pending,
  COUNT(assignment_deadline) as with_deadline,
  MIN(assignment_deadline AT TIME ZONE 'America/New_York') as earliest_deadline,
  MAX(assignment_deadline AT TIME ZONE 'America/New_York') as latest_deadline
FROM jobs
WHERE assignment_status = 'pending'
  AND assigned_to IS NOT NULL;

-- =====================================================
-- 5. SAMPLE PENDING JOBS (First 5)
-- =====================================================
SELECT 
  'Sample Pending Jobs' as check_type,
  id,
  work_order_num,
  assigned_to,
  assignment_status,
  (assigned_at AT TIME ZONE 'America/New_York')::timestamp as assigned_at_et,
  (assignment_deadline AT TIME ZONE 'America/New_York')::timestamp as deadline_et,
  CASE 
    WHEN assignment_deadline < NOW() THEN 'EXPIRED'
    ELSE EXTRACT(EPOCH FROM (assignment_deadline - NOW()))/3600 || ' hours remaining'
  END as time_status
FROM jobs
WHERE assignment_status = 'pending'
  AND assigned_to IS NOT NULL
ORDER BY assignment_deadline
LIMIT 5;

-- =====================================================
-- 6. CHECK CRON JOB
-- =====================================================
SELECT 
  'Cron Job Check' as check_type,
  jobid,
  jobname,
  schedule,
  command,
  active,
  nodename,
  nodeport
FROM cron.job
WHERE jobname LIKE '%decline%' OR jobname LIKE '%assignment%'
ORDER BY jobname;

-- =====================================================
-- 7. CHECK RECENT CRON EXECUTIONS
-- =====================================================
SELECT 
  'Recent Cron Executions' as check_type,
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time AT TIME ZONE 'America/New_York' as start_time_et,
  end_time AT TIME ZONE 'America/New_York' as end_time_et
FROM cron.job_run_details
WHERE jobid IN (
  SELECT jobid FROM cron.job 
  WHERE jobname LIKE '%decline%' OR jobname LIKE '%assignment%'
)
ORDER BY start_time DESC
LIMIT 10;

-- =====================================================
-- 8. CHECK FOR EXPIRED ASSIGNMENTS
-- =====================================================
SELECT 
  'Expired Assignments Check' as check_type,
  COUNT(*) as total_expired,
  COUNT(CASE WHEN assignment_status = 'pending' THEN 1 END) as still_pending_expired,
  COUNT(CASE WHEN assignment_status = 'auto_declined' THEN 1 END) as auto_declined_count
FROM jobs
WHERE assignment_deadline < NOW()
  AND assignment_deadline IS NOT NULL;

-- =====================================================
-- 9. SAMPLE EXPIRED JOBS
-- =====================================================
SELECT 
  'Expired Jobs Sample' as check_type,
  id,
  work_order_num,
  assignment_status,
  (assignment_deadline AT TIME ZONE 'America/New_York')::timestamp as deadline_et,
  (NOW() AT TIME ZONE 'America/New_York')::timestamp as current_time_et,
  EXTRACT(EPOCH FROM (NOW() - assignment_deadline))/3600 || ' hours overdue' as overdue_by
FROM jobs
WHERE assignment_deadline < NOW()
  AND assignment_deadline IS NOT NULL
ORDER BY assignment_deadline DESC
LIMIT 5;

-- =====================================================
-- 10. TEST DEADLINE CALCULATION
-- =====================================================
SELECT 
  'Deadline Calculation Test' as check_type,
  NOW() AT TIME ZONE 'America/New_York' as current_time_et,
  calculate_assignment_deadline(NOW()) AT TIME ZONE 'America/New_York' as calculated_deadline_et,
  CASE 
    WHEN EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/New_York')) < 15 THEN 'Should be today at 3:30 PM'
    WHEN EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/New_York')) >= 15 THEN 'Should be next business day at 3:30 PM'
  END as expected_behavior;

-- =====================================================
-- 11. CHECK JOB STATUS SUMMARY
-- =====================================================
SELECT 
  'Job Status Summary' as check_type,
  assignment_status,
  COUNT(*) as job_count,
  COUNT(assignment_deadline) as with_deadline,
  COUNT(assigned_to) as with_assignee
FROM jobs
GROUP BY assignment_status
ORDER BY assignment_status;

-- =====================================================
-- 12. CHECK EDGE FUNCTION (via database log)
-- =====================================================
-- Note: This checks if the function is being called
-- You may need to check Supabase Dashboard > Edge Functions for actual deployment
SELECT 
  'Edge Function Info' as check_type,
  'Check Supabase Dashboard > Edge Functions' as message,
  'Look for: auto-decline-jobs' as function_name,
  'Should be deployed and active' as expected_status;

-- =====================================================
-- SUMMARY & NEXT STEPS
-- =====================================================
SELECT 
  'Summary' as section,
  'All checks above should show:' as item,
  '1. All columns exist (assignment_deadline, assigned_at, assignment_status)' as check_1,
  '2. All 5 functions exist' as check_2,
  '3. Indexes are created' as check_3,
  '4. Pending jobs have deadlines set' as check_4,
  '5. Cron job is active and running' as check_5,
  '6. Auto-declines are being logged' as check_6;

SELECT 
  'Next Steps' as section,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'assignment_deadline')
    THEN '❌ RUN: add_assignment_deadline_columns.sql'
    ELSE '✅ Columns exist'
  END as step_1,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'calculate_assignment_deadline')
    THEN '❌ RUN: create_assignment_deadline_functions.sql'
    ELSE '✅ Functions exist'
  END as step_2,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'jobs' AND indexname LIKE '%assignment%')
    THEN '❌ RUN: create_assignment_indexes.sql'
    ELSE '✅ Indexes exist'
  END as step_3,
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname LIKE '%decline%')
    THEN '❌ SETUP: Auto-decline cron job'
    ELSE '✅ Cron job exists'
  END as step_4;
