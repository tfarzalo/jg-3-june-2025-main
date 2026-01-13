-- QUICK VERIFICATION: Is the Notification System Working?
-- Run this in your Supabase SQL Editor (Production)

-- =============================================================================
-- TEST 1: Create a test notification for yourself
-- =============================================================================
-- This will create a notification that you SHOULD see in your bell icon

SELECT send_notification(
  auth.uid(),
  'Test Notification - System Check',
  'If you can see this in your bell icon, the notification system is working correctly!',
  'system',
  NULL,
  NULL
) as notification_id;

-- After running this, check your bell icon in the app
-- You SHOULD see a new notification with the title "Test Notification - System Check"

-- =============================================================================
-- If you see the test notification, the system is working! ✅
-- If you DON'T see it, there might be a connection issue ❌
-- =============================================================================

-- =============================================================================
-- TEST 2: Check if you're seeing your own job changes (you shouldn't)
-- =============================================================================

-- This shows your recent job phase changes
SELECT 
  jpc.changed_at,
  jpc.job_id,
  (SELECT work_order_num FROM jobs WHERE id = jpc.job_id) as wo_number,
  fp.job_phase_label as from_phase,
  tp.job_phase_label as to_phase,
  'You changed this' as note,
  'You should NOT have gotten a notification for this' as expected_behavior
FROM job_phase_changes jpc
LEFT JOIN job_phases fp ON fp.id = jpc.from_phase_id
JOIN job_phases tp ON tp.id = jpc.to_phase_id
WHERE jpc.changed_by = auth.uid()
ORDER BY jpc.changed_at DESC
LIMIT 5;

-- =============================================================================
-- TEST 3: Check if others' changes created notifications for you
-- =============================================================================

-- This shows job changes made by OTHERS that should have created notifications for you
SELECT 
  jpc.changed_at as change_time,
  (SELECT full_name FROM profiles WHERE id = jpc.changed_by) as who_changed_it,
  (SELECT work_order_num FROM jobs WHERE id = jpc.job_id) as wo_number,
  fp.job_phase_label as from_phase,
  tp.job_phase_label as to_phase,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM user_notifications 
      WHERE user_id = auth.uid() 
        AND reference_id = jpc.job_id 
        AND type = 'job_phase_change'
        AND created_at >= jpc.changed_at
    ) THEN '✅ Notification was created for you'
    ELSE '❌ No notification found (might be a problem)'
  END as notification_status
FROM job_phase_changes jpc
LEFT JOIN job_phases fp ON fp.id = jpc.from_phase_id
JOIN job_phases tp ON tp.id = jpc.to_phase_id
WHERE jpc.changed_by != auth.uid()  -- Changes by OTHER people
  AND jpc.changed_at > NOW() - INTERVAL '7 days'  -- Last 7 days
ORDER BY jpc.changed_at DESC
LIMIT 10;

-- =============================================================================
-- TEST 4: Your notification settings
-- =============================================================================

SELECT 
  full_name,
  role,
  notification_settings,
  CASE 
    WHEN role IN ('admin', 'jg_management') THEN '✅ You should receive notifications'
    WHEN role = 'subcontractor' THEN '❌ Subcontractors do not receive notifications'
    ELSE '⚠️  Your role: ' || role || ' - check if this role should receive notifications'
  END as should_you_get_notifications,
  CASE 
    WHEN notification_settings IS NULL THEN '✅ All notifications enabled (default)'
    WHEN (notification_settings->>'job_phase_changes')::boolean = true THEN '✅ Job phase notifications enabled'
    WHEN (notification_settings->>'job_phase_changes')::boolean = false THEN '❌ Job phase notifications DISABLED in your settings'
    ELSE '✅ Default enabled'
  END as job_phase_notification_setting
FROM profiles
WHERE id = auth.uid();

-- =============================================================================
-- INTERPRETATION GUIDE
-- =============================================================================
-- 
-- TEST 1: Test Notification
--   ✅ If you see the notification in bell icon → System is working
--   ❌ If you don't see it → Check frontend connection or browser console
--
-- TEST 2: Your Own Changes
--   ✅ Should NOT have notifications for your own changes
--   This is the expected behavior!
--
-- TEST 3: Others' Changes  
--   ✅ If "Notification was created" → System is working correctly
--   ❌ If "No notification found" → Check if migration was applied
--
-- TEST 4: Your Settings
--   ✅ Role should be 'admin' or 'jg_management'
--   ✅ Job phase notifications should be enabled
--   ❌ If disabled, you won't get notifications
--
-- =============================================================================
-- EXPECTED RESULTS
-- =============================================================================
--
-- Scenario A: "I changed a job phase"
--   → You should NOT see a notification (this is correct! ✅)
--
-- Scenario B: "Someone else changed a job phase"
--   → You SHOULD see a notification (if you're admin/jg_management ✅)
--
-- Scenario C: "I ran TEST 1 above"
--   → You SHOULD see the test notification in bell icon ✅
--
-- =============================================================================
