-- Diagnostic query to check jobs for November 23, 2025
-- Run this in the Supabase SQL Editor to see what's in the database

-- 1. Check all jobs with scheduled dates around today
SELECT 
  id,
  work_order_number,
  scheduled_date,
  scheduled_date AT TIME ZONE 'America/New_York' as scheduled_date_et,
  DATE(scheduled_date AT TIME ZONE 'America/New_York') as date_only_et,
  status,
  created_at
FROM jobs
WHERE scheduled_date IS NOT NULL
  AND DATE(scheduled_date AT TIME ZONE 'America/New_York') >= '2025-11-20'
  AND DATE(scheduled_date AT TIME ZONE 'America/New_York') <= '2025-11-25'
ORDER BY scheduled_date;

-- 2. Check specifically for November 23, 2025
SELECT 
  id,
  work_order_number,
  scheduled_date,
  scheduled_date AT TIME ZONE 'America/New_York' as scheduled_date_et,
  status
FROM jobs
WHERE DATE(scheduled_date AT TIME ZONE 'America/New_York') = '2025-11-23'
  AND status != 'Cancelled';

-- 3. Count jobs by date for this week
SELECT 
  DATE(scheduled_date AT TIME ZONE 'America/New_York') as job_date,
  COUNT(*) as job_count,
  COUNT(*) FILTER (WHERE status != 'Cancelled') as active_job_count
FROM jobs
WHERE scheduled_date IS NOT NULL
  AND DATE(scheduled_date AT TIME ZONE 'America/New_York') >= '2025-11-20'
  AND DATE(scheduled_date AT TIME ZONE 'America/New_York') <= '2025-11-30'
GROUP BY DATE(scheduled_date AT TIME ZONE 'America/New_York')
ORDER BY job_date;
