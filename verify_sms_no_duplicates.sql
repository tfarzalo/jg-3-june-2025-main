-- SMS Duplication Verification Queries
-- Run these to verify no duplicate SMS notifications are being sent

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Check Recent SMS Notifications (Last 24 Hours)
-- ═══════════════════════════════════════════════════════════════════════════
-- Shows all SMS logs for admin events, grouped by event to spot duplicates

SELECT 
  event_type,
  created_at,
  user_id,
  phone_last4,
  status,
  skip_reason,
  SUBSTRING(message_body, 1, 80) as message_preview
FROM sms_notification_logs
WHERE 
  event_type IN ('work_order_submitted', 'job_accepted', 'charges_approved')
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC, event_type, user_id;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Count SMS per Admin per Event (Detect Duplicates)
-- ═══════════════════════════════════════════════════════════════════════════
-- Expected: Each admin should appear ONCE per unique event occurrence
-- If count > 1 for same timestamp window, we have duplicates

SELECT 
  event_type,
  user_id,
  p.full_name as admin_name,
  COUNT(*) as sms_count,
  STRING_AGG(status, ', ') as all_statuses,
  MAX(created_at) as most_recent
FROM sms_notification_logs l
LEFT JOIN profiles p ON l.user_id = p.id
WHERE 
  event_type IN ('work_order_submitted', 'job_accepted', 'charges_approved')
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY event_type, user_id, p.full_name
HAVING COUNT(*) > 1  -- Only show potential duplicates
ORDER BY most_recent DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Check Admin SMS Settings
-- ═══════════════════════════════════════════════════════════════════════════
-- Verify which admins have SMS notifications enabled for each event type

SELECT 
  p.id,
  p.full_name,
  p.role,
  p.sms_phone,
  p.sms_consent_given,
  s.sms_enabled,
  s.notify_admin_job_accepted,
  s.notify_admin_work_order_submitted,
  s.notify_admin_charges_approved,
  CASE 
    WHEN p.sms_phone IS NULL THEN '❌ No phone'
    WHEN p.sms_consent_given = false THEN '❌ No consent'
    WHEN s.sms_enabled = false THEN '❌ SMS disabled'
    ELSE '✅ Eligible'
  END as eligibility_status
FROM profiles p
LEFT JOIN user_sms_notification_settings s ON p.id = s.user_id
WHERE p.role IN ('admin', 'is_super_admin', 'jg_management')
ORDER BY p.full_name;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Check Deduplication Function
-- ═══════════════════════════════════════════════════════════════════════════
-- Test the dedup function - should return 0 if no recent duplicates

SELECT sms_recent_count(
  '<USER_ID_HERE>'::uuid,  -- Replace with actual admin user_id
  'work_order_submitted',
  60  -- 60 second window
) as recent_count;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Check SMS Queue Status
-- ═══════════════════════════════════════════════════════════════════════════
-- Shows pending and processing SMS in the queue

SELECT 
  q.created_at,
  q.event_type,
  p.full_name as recipient_name,
  q.phone_number,
  q.status,
  q.attempt_count,
  q.last_error,
  SUBSTRING(q.message_body, 1, 80) as message_preview
FROM sms_notification_queue q
LEFT JOIN profiles p ON q.user_id = p.id
WHERE 
  event_type IN ('work_order_submitted', 'job_accepted', 'charges_approved')
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Summary Stats - SMS Sent Today
-- ═══════════════════════════════════════════════════════════════════════════

SELECT 
  event_type,
  status,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_admins,
  MIN(created_at) as first_sent,
  MAX(created_at) as last_sent
FROM sms_notification_logs
WHERE 
  event_type IN ('work_order_submitted', 'job_accepted', 'charges_approved')
  AND created_at > CURRENT_DATE
GROUP BY event_type, status
ORDER BY event_type, status;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Check for Rapid-Fire Duplicates (Within 60 Seconds)
-- ═══════════════════════════════════════════════════════════════════════════
-- Detects if the same user+event occurred multiple times within dedup window

WITH duplicate_check AS (
  SELECT 
    user_id,
    event_type,
    created_at,
    LAG(created_at) OVER (PARTITION BY user_id, event_type ORDER BY created_at) as prev_created_at
  FROM sms_notification_logs
  WHERE 
    event_type IN ('work_order_submitted', 'job_accepted', 'charges_approved')
    AND created_at > NOW() - INTERVAL '24 hours'
)
SELECT 
  user_id,
  p.full_name,
  event_type,
  created_at,
  prev_created_at,
  EXTRACT(EPOCH FROM (created_at - prev_created_at)) as seconds_between
FROM duplicate_check d
LEFT JOIN profiles p ON d.user_id = p.id
WHERE prev_created_at IS NOT NULL
AND created_at - prev_created_at < INTERVAL '60 seconds'
ORDER BY created_at DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- EXPECTED RESULTS (Good State)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Query 2 (Duplicates): Should return ZERO rows
-- Query 3 (Settings): Should show which admins are eligible
-- Query 4 (Dedup): Should return 0 if no recent duplicates
-- Query 6 (Summary): unique_admins count should equal the number of eligible admins
-- Query 7 (Rapid-Fire): Should return ZERO rows (or only 'skipped' status with dedup reason)
--
-- If Query 2 or 7 shows duplicates with status='queued' or 'sent', there's still an issue!
-- ═══════════════════════════════════════════════════════════════════════════
