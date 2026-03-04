-- ============================================================================
-- COUNTDOWN TIMER FEATURE - PRODUCTION DEPLOYMENT VERIFICATION
-- ============================================================================
-- Run this script on your production database to verify the feature is deployed
-- Date: February 26, 2026
-- ============================================================================

\echo '==================================================================='
\echo 'COUNTDOWN TIMER DEPLOYMENT VERIFICATION'
\echo '==================================================================='
\echo ''

-- ============================================================================
-- 1. CHECK DATABASE COLUMNS
-- ============================================================================
\echo '1. Checking if assignment deadline columns exist...'
\echo ''

SELECT 
    CASE 
        WHEN COUNT(*) = 3 THEN '✅ All columns exist'
        ELSE '❌ Missing columns: ' || (3 - COUNT(*))::text
    END as column_status
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('assignment_deadline', 'assigned_at', 'assignment_status');

SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('assignment_deadline', 'assigned_at', 'assignment_status')
ORDER BY column_name;

\echo ''

-- ============================================================================
-- 2. CHECK DATABASE FUNCTIONS
-- ============================================================================
\echo '2. Checking if database functions exist...'
\echo ''

SELECT 
    CASE 
        WHEN COUNT(*) = 5 THEN '✅ All functions exist'
        ELSE '❌ Missing functions: ' || (5 - COUNT(*))::text
    END as function_status
FROM pg_proc 
WHERE proname IN (
    'calculate_assignment_deadline',
    'assign_job_to_subcontractor',
    'accept_job_assignment',
    'decline_job_assignment',
    'auto_decline_expired_assignments'
);

SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname IN (
    'calculate_assignment_deadline',
    'assign_job_to_subcontractor',
    'accept_job_assignment',
    'decline_job_assignment',
    'auto_decline_expired_assignments'
)
ORDER BY proname;

\echo ''

-- ============================================================================
-- 3. CHECK CRON JOB
-- ============================================================================
\echo '3. Checking if pg_cron extension and job exist...'
\echo ''

-- Check if pg_cron extension is installed
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ pg_cron extension installed'
        ELSE '❌ pg_cron extension NOT installed'
    END as cron_extension_status
FROM pg_extension 
WHERE extname = 'pg_cron';

-- Check if cron job exists
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Auto-decline cron job configured'
        ELSE '❌ Auto-decline cron job NOT configured'
    END as cron_job_status
FROM cron.job 
WHERE jobname = 'auto-decline-expired-assignments';

-- Show cron job details
SELECT 
    jobid,
    schedule,
    command,
    active,
    jobname
FROM cron.job 
WHERE jobname = 'auto-decline-expired-assignments';

\echo ''

-- ============================================================================
-- 4. CHECK RECENT CRON EXECUTIONS
-- ============================================================================
\echo '4. Checking recent cron job executions...'
\echo ''

SELECT 
    job_id,
    run_id,
    status,
    start_time,
    end_time,
    return_message
FROM cron.job_run_details 
WHERE job_id = (SELECT jobid FROM cron.job WHERE jobname = 'auto-decline-expired-assignments')
ORDER BY start_time DESC 
LIMIT 5;

\echo ''

-- ============================================================================
-- 5. CHECK PENDING ASSIGNMENTS
-- ============================================================================
\echo '5. Checking current pending assignments with deadlines...'
\echo ''

SELECT 
    COUNT(*) as total_pending_with_deadline,
    COUNT(CASE WHEN assignment_deadline > NOW() THEN 1 END) as active_pending,
    COUNT(CASE WHEN assignment_deadline <= NOW() THEN 1 END) as expired_pending
FROM jobs 
WHERE assignment_status = 'pending'
AND assignment_deadline IS NOT NULL;

SELECT 
    j.work_order_num,
    u.full_name as assigned_to,
    j.assignment_deadline,
    (j.assignment_deadline AT TIME ZONE 'America/New_York')::timestamp as deadline_et,
    CASE 
        WHEN j.assignment_deadline > NOW() THEN 
            ROUND(EXTRACT(EPOCH FROM (j.assignment_deadline - NOW())) / 3600, 2) || ' hours remaining'
        ELSE 
            'EXPIRED ' || ROUND(EXTRACT(EPOCH FROM (NOW() - j.assignment_deadline)) / 3600, 2) || ' hours ago'
    END as status
FROM jobs j
LEFT JOIN users u ON j.assigned_to = u.id
WHERE j.assignment_status = 'pending'
AND j.assignment_deadline IS NOT NULL
ORDER BY j.assignment_deadline
LIMIT 10;

\echo ''

-- ============================================================================
-- 6. CHECK RECENT ASSIGNMENT ACTIVITY
-- ============================================================================
\echo '6. Checking recent assignment-related activity...'
\echo ''

SELECT 
    jal.created_at,
    jal.action,
    j.work_order_num,
    u.full_name as user_name,
    LEFT(jal.description, 100) as description
FROM job_activity_logs jal
JOIN jobs j ON jal.job_id = j.id
LEFT JOIN users u ON jal.user_id = u.id
WHERE jal.action IN (
    'job_assigned',
    'assignment_accepted',
    'assignment_declined',
    'assignment_auto_declined'
)
ORDER BY jal.created_at DESC
LIMIT 10;

\echo ''

-- ============================================================================
-- 7. CHECK INDEXES
-- ============================================================================
\echo '7. Checking if performance indexes exist...'
\echo ''

SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'jobs' 
AND indexname IN (
    'idx_jobs_assignment_status',
    'idx_jobs_assignment_deadline',
    'idx_jobs_assigned_to_status'
)
ORDER BY indexname;

\echo ''

-- ============================================================================
-- 8. SUMMARY
-- ============================================================================
\echo '==================================================================='
\echo 'DEPLOYMENT VERIFICATION SUMMARY'
\echo '==================================================================='
\echo ''

WITH verification AS (
    SELECT 
        'Database Columns' as component,
        CASE WHEN COUNT(*) = 3 THEN '✅ OK' ELSE '❌ MISSING' END as status
    FROM information_schema.columns 
    WHERE table_name = 'jobs' 
    AND column_name IN ('assignment_deadline', 'assigned_at', 'assignment_status')
    
    UNION ALL
    
    SELECT 
        'Database Functions' as component,
        CASE WHEN COUNT(*) = 5 THEN '✅ OK' ELSE '❌ MISSING' END as status
    FROM pg_proc 
    WHERE proname IN (
        'calculate_assignment_deadline',
        'assign_job_to_subcontractor',
        'accept_job_assignment',
        'decline_job_assignment',
        'auto_decline_expired_assignments'
    )
    
    UNION ALL
    
    SELECT 
        'pg_cron Extension' as component,
        CASE WHEN COUNT(*) > 0 THEN '✅ OK' ELSE '❌ MISSING' END as status
    FROM pg_extension 
    WHERE extname = 'pg_cron'
    
    UNION ALL
    
    SELECT 
        'Cron Job' as component,
        CASE WHEN COUNT(*) > 0 THEN '✅ OK' ELSE '❌ MISSING' END as status
    FROM cron.job 
    WHERE jobname = 'auto-decline-expired-assignments'
    
    UNION ALL
    
    SELECT 
        'Performance Indexes' as component,
        CASE WHEN COUNT(*) >= 2 THEN '✅ OK' ELSE '⚠️  PARTIAL' END as status
    FROM pg_indexes 
    WHERE tablename = 'jobs' 
    AND indexname LIKE 'idx_jobs_assignment%'
)
SELECT * FROM verification;

\echo ''
\echo 'Run this query to test the assignment function:'
\echo 'SELECT assign_job_to_subcontractor([job_id], [user_id]);'
\echo ''
\echo 'For frontend verification, see: COUNTDOWN_TIMER_PRODUCTION_CHECKLIST.md'
\echo '==================================================================='
