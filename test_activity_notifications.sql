-- Test Activity Logging and Notification System
-- Run these queries in order to test the complete flow

-- ============================================
-- TEST 1: Create a test job activity
-- ============================================
-- This should automatically create notifications for all admin/management users
SELECT log_activity(
  'job',
  gen_random_uuid(),
  'created',
  'Test Job #999999 created for unit TEST-101',
  jsonb_build_object(
    'work_order_num', 999999,
    'unit_number', 'TEST-101',
    'property_id', gen_random_uuid()
  )
);

-- ============================================
-- TEST 2: Check if activity was logged
-- ============================================
SELECT * FROM activity_log 
WHERE description LIKE '%TEST-101%'
ORDER BY created_at DESC 
LIMIT 1;

-- ============================================
-- TEST 3: Check if notifications were created
-- ============================================
SELECT 
  n.id,
  n.title,
  n.message,
  n.type,
  n.is_read,
  n.activity_log_id,
  n.entity_id,
  n.metadata,
  n.created_at
FROM notifications n
WHERE n.title = 'New Job Created'
ORDER BY n.created_at DESC
LIMIT 5;

-- ============================================
-- TEST 4: Check notification with user details
-- ============================================
SELECT * FROM notifications_view
WHERE title = 'New Job Created'
ORDER BY created_at DESC
LIMIT 5;

-- ============================================
-- TEST 5: Test marking notification as read
-- ============================================
-- Replace <notification-id> with an actual ID from TEST 3
-- SELECT mark_notification_read('<notification-id>');

-- Verify it was marked as read:
-- SELECT id, title, is_read FROM notifications WHERE id = '<notification-id>';

-- ============================================
-- TEST 6: Test mark all as read
-- ============================================
-- SELECT mark_all_notifications_read();

-- Verify all are marked as read:
-- SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = auth.uid() AND is_read = false;

-- ============================================
-- TEST 7: Create different entity types
-- ============================================

-- Test property creation
SELECT log_activity(
  'property',
  gen_random_uuid(),
  'created',
  'Property "Test Apartments" created',
  jsonb_build_object('name', 'Test Apartments', 'city', 'Phoenix', 'state', 'AZ')
);

-- Test property group creation
SELECT log_activity(
  'property_group',
  gen_random_uuid(),
  'created',
  'Property group "Test Group" created',
  jsonb_build_object('name', 'Test Group')
);

-- Test callback creation
SELECT log_activity(
  'callback',
  gen_random_uuid(),
  'created',
  'Callback scheduled for 2025-11-30',
  jsonb_build_object('scheduled_date', '2025-11-30', 'reason', 'Follow-up inspection')
);

-- Test note creation
SELECT log_activity(
  'note',
  gen_random_uuid(),
  'created',
  'Note added to Job #123456',
  jsonb_build_object('note_preview', 'This is a test note for verification')
);

-- ============================================
-- TEST 8: Check all test notifications
-- ============================================
SELECT 
  type,
  title,
  COUNT(*) as notification_count,
  MAX(created_at) as latest_notification
FROM notifications
WHERE created_at > NOW() - INTERVAL '10 minutes'
GROUP BY type, title
ORDER BY latest_notification DESC;

-- ============================================
-- TEST 9: Check activity log summary
-- ============================================
SELECT 
  entity_type,
  action,
  COUNT(*) as activity_count,
  MAX(created_at) as latest_activity
FROM activity_log
WHERE created_at > NOW() - INTERVAL '10 minutes'
GROUP BY entity_type, action
ORDER BY latest_activity DESC;

-- ============================================
-- TEST 10: Clean up test data (optional)
-- ============================================
-- Uncomment to remove test data:

-- DELETE FROM notifications WHERE title LIKE '%Test%' OR message LIKE '%TEST-%';
-- DELETE FROM activity_log WHERE description LIKE '%Test%' OR description LIKE '%TEST-%';

-- ============================================
-- VERIFICATION CHECKLIST
-- ============================================
-- [ ] TEST 1: log_activity returns a UUID (activity created)
-- [ ] TEST 2: Activity appears in activity_log table
-- [ ] TEST 3: Notifications created for admin/management users
-- [ ] TEST 4: notifications_view shows creator names
-- [ ] TEST 5: mark_notification_read works
-- [ ] TEST 6: mark_all_notifications_read works
-- [ ] TEST 7: Different entity types create appropriate notifications
-- [ ] TEST 8: All notification types are properly categorized
-- [ ] TEST 9: Activity log captures all entity types
-- [ ] TEST 10: You can clean up test data successfully

-- ============================================
-- SUCCESS CRITERIA
-- ============================================
-- ✅ Each log_activity call returns a UUID
-- ✅ activity_log table has entries
-- ✅ notifications table has entries
-- ✅ notifications_view joins data correctly
-- ✅ No duplicate notifications
-- ✅ Creator doesn't receive their own notification
-- ✅ All admin/management users receive notifications
-- ✅ Metadata is stored as JSONB
-- ✅ Functions execute without errors
