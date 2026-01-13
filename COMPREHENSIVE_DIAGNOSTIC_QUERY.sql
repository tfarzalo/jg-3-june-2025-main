-- =========================================
-- COMPREHENSIVE DIAGNOSTIC QUERY
-- For Daily Agenda Email and Notification Recipients
-- =========================================

-- 1. Check table structure
SELECT 
  'daily_email_settings table columns' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'daily_email_settings'
ORDER BY ordinal_position;

-- 2. Check all distinct role values in profiles
SELECT 
  'Distinct roles in profiles' as check_type,
  role,
  COUNT(*) as user_count,
  array_agg(email ORDER BY email) as emails
FROM profiles
GROUP BY role
ORDER BY role;

-- 3. Check users with daily email enabled
SELECT 
  'Users with daily email enabled' as check_type,
  p.email,
  p.role,
  des.enabled,
  des.created_at,
  des.updated_at
FROM daily_email_settings des
JOIN profiles p ON p.id = des.user_id
WHERE des.enabled = true
ORDER BY p.email;

-- 4. Check all admin/manager type users (case-insensitive)
SELECT 
  'Admin and Manager users' as check_type,
  id,
  email,
  full_name,
  role,
  created_at
FROM profiles
WHERE LOWER(role) IN ('admin', 'management', 'jg management', 'manager')
  OR role ILIKE '%admin%'
  OR role ILIKE '%manage%'
ORDER BY role, email;

-- 5. Check notification recipient preferences (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'notification_recipient_settings'
  ) THEN
    RAISE NOTICE 'Checking notification_recipient_settings table...';
    
    -- This would need to be run separately if the table exists
    -- SELECT * FROM notification_recipient_settings;
  ELSE
    RAISE NOTICE 'notification_recipient_settings table does not exist';
  END IF;
END $$;

-- 6. Check internal_notification_emails schema
SELECT 
  'internal_notification_emails table structure' as check_type,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'internal_notification_emails'
ORDER BY ordinal_position;

-- 7. Count of internal notification emails sent
SELECT 
  'Internal notification email counts' as check_type,
  COUNT(*) as total_emails,
  COUNT(CASE WHEN recipient_emails IS NOT NULL THEN 1 END) as with_recipients,
  COUNT(CASE WHEN recipient_emails IS NULL THEN 1 END) as without_recipients
FROM internal_notification_emails;

-- 8. Sample internal notification emails
SELECT 
  'Sample internal notification emails' as check_type,
  job_id,
  decision,
  recipient_emails,
  sent_at,
  sent_by_email
FROM internal_notification_emails
ORDER BY sent_at DESC
LIMIT 5;

-- 9. Check pg_cron jobs
SELECT 
  'Scheduled cron jobs' as check_type,
  jobid,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active,
  jobname
FROM cron.job
ORDER BY jobid;

-- 10. Check recent cron job runs
SELECT 
  'Recent cron job executions' as check_type,
  jr.jobid,
  cj.jobname,
  jr.runid,
  jr.job_pid,
  jr.database,
  jr.command,
  jr.status,
  jr.return_message,
  jr.start_time,
  jr.end_time
FROM cron.job_run_details jr
LEFT JOIN cron.job cj ON cj.jobid = jr.jobid
ORDER BY jr.start_time DESC
LIMIT 10;

-- 11. Check Edge Functions (if in Supabase)
SELECT 
  'Edge functions check' as check_type,
  schema_name,
  routine_name,
  routine_type,
  created
FROM information_schema.routines
WHERE routine_name LIKE '%daily%agenda%' 
   OR routine_name LIKE '%send%email%'
ORDER BY routine_name;

-- 12. Final summary
SELECT 
  'Summary' as check_type,
  (SELECT COUNT(*) FROM profiles WHERE LOWER(role) IN ('admin', 'management', 'jg management', 'manager')) as admin_manager_count,
  (SELECT COUNT(*) FROM daily_email_settings WHERE enabled = true) as daily_email_enabled_count,
  (SELECT COUNT(*) FROM internal_notification_emails) as notification_emails_sent,
  (SELECT COUNT(*) FROM cron.job WHERE active = true) as active_cron_jobs;
