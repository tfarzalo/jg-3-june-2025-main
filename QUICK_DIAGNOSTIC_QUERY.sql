-- =========================================
-- QUICK DIAGNOSTIC QUERY
-- Essential checks for Daily Agenda and Notifications
-- =========================================

-- 1. All distinct roles and counts
SELECT 
  role,
  COUNT(*) as user_count
FROM profiles
GROUP BY role
ORDER BY role;

-- 2. Admin/Manager users (check what roles actually exist)
SELECT 
  id,
  email,
  full_name,
  role
FROM profiles
WHERE role ILIKE '%admin%'
   OR role ILIKE '%manage%'
ORDER BY role, email;

-- 3. Daily email settings status
SELECT 
  p.email,
  p.role,
  COALESCE(des.enabled, false) as daily_email_enabled
FROM profiles p
LEFT JOIN daily_email_settings des ON des.user_id = p.id
WHERE role ILIKE '%admin%'
   OR role ILIKE '%manage%'
ORDER BY p.email;

-- 4. Active cron jobs
SELECT 
  jobid,
  schedule,
  command,
  active,
  jobname
FROM cron.job
WHERE active = true
ORDER BY jobid;

-- 5. Recent cron job runs (last 5)
SELECT 
  jr.jobid,
  cj.jobname,
  jr.status,
  jr.return_message,
  jr.start_time,
  jr.end_time
FROM cron.job_run_details jr
LEFT JOIN cron.job cj ON cj.jobid = jr.jobid
ORDER BY jr.start_time DESC
LIMIT 5;
