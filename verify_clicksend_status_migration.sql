-- ClickSend Status Migration - Verification Script
-- Run this in Supabase SQL Editor to verify the migration was applied correctly

-- ============================================================================
-- STEP 1: Check if the constraint allows arbitrary status values
-- ============================================================================
SELECT 
  constraint_name,
  check_clause,
  CASE 
    WHEN check_clause LIKE '%status IS NOT NULL%' 
     AND check_clause LIKE '%length(trim%' 
     AND check_clause NOT LIKE '%IN (%'
    THEN '✅ PASS - Constraint allows arbitrary status values'
    ELSE '❌ FAIL - Constraint still uses old enum'
  END as status
FROM information_schema.check_constraints
WHERE constraint_name = 'sms_notification_logs_status_check';

-- Expected output:
-- constraint_name: sms_notification_logs_status_check
-- check_clause: ((status IS NOT NULL) AND (length(trim(BOTH FROM status)) > 0))
-- status: ✅ PASS - Constraint allows arbitrary status values


-- ============================================================================
-- STEP 2: Check for any ClickSend-specific status values in logs
-- ============================================================================
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence,
  CASE 
    WHEN status IN ('queued', 'sent', 'failed', 'skipped', 'simulated') 
    THEN 'Legacy/internal status'
    ELSE 'ClickSend API status'
  END as status_type
FROM sms_notification_logs
GROUP BY status
ORDER BY 
  CASE 
    WHEN status IN ('queued', 'sent', 'failed', 'skipped', 'simulated') THEN 1
    ELSE 2
  END,
  count DESC;

-- Expected output:
-- Should show both legacy statuses (sent, failed, etc.) and new ClickSend statuses
-- (SUCCESS, REGISTRATION_NEEDED, etc.) if any SMS have been sent since deployment


-- ============================================================================
-- STEP 3: Check recent logs for status distribution
-- ============================================================================
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 2) as percentage
FROM sms_notification_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY status
ORDER BY count DESC;

-- This shows what statuses are most common in the last 7 days


-- ============================================================================
-- STEP 4: Check for any logs with ClickSend status but no provider_status
-- ============================================================================
SELECT 
  id,
  status,
  provider_status,
  error_message,
  created_at,
  CASE 
    WHEN status = provider_status THEN '✅ Status matches provider_status'
    WHEN provider_status IS NULL AND status IN ('queued', 'failed', 'skipped', 'simulated') THEN '✅ Internal status (no provider_status expected)'
    WHEN provider_status IS NULL THEN '⚠️  ClickSend status but no provider_status recorded'
    ELSE '❓ Status and provider_status differ'
  END as validation_status
FROM sms_notification_logs
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 50;

-- This helps identify any inconsistencies between status and provider_status fields


-- ============================================================================
-- STEP 5: Test inserting a ClickSend status value (dry run)
-- ============================================================================
-- This will show if the constraint is working correctly
-- We'll roll back immediately so it doesn't actually insert data

BEGIN;

-- Try to insert a record with a ClickSend status
INSERT INTO sms_notification_logs (
  event_type,
  phone_last4,
  message_body,
  status,
  provider_status,
  metadata
) VALUES (
  'test',
  '1234',
  'Test message for constraint verification',
  'REGISTRATION_NEEDED',  -- ClickSend status
  'REGISTRATION_NEEDED',
  '{"test": true, "timestamp": "' || NOW()::text || '"}'::jsonb
);

-- Check if it was inserted
SELECT 
  id,
  status,
  provider_status,
  '✅ SUCCESS - Constraint allows ClickSend status values' as result
FROM sms_notification_logs
WHERE metadata->>'test' = 'true'
  AND created_at > NOW() - INTERVAL '1 minute';

-- Roll back the test insert
ROLLBACK;

-- Expected output:
-- Should show the test record with status='REGISTRATION_NEEDED'
-- Then ROLLBACK removes it


-- ============================================================================
-- STEP 6: Check column comment documentation
-- ============================================================================
SELECT 
  column_name,
  col_description('sms_notification_logs'::regclass, ordinal_position) as column_comment
FROM information_schema.columns
WHERE table_name = 'sms_notification_logs'
  AND column_name = 'status';

-- Expected output:
-- Should mention ClickSend status values like SUCCESS, REGISTRATION_NEEDED, etc.


-- ============================================================================
-- SUMMARY QUERY: Overall migration health check
-- ============================================================================
WITH constraint_check AS (
  SELECT 
    CASE 
      WHEN check_clause LIKE '%status IS NOT NULL%' 
       AND check_clause LIKE '%length(trim%' 
       AND check_clause NOT LIKE '%IN (%'
      THEN true
      ELSE false
    END as allows_arbitrary_values
  FROM information_schema.check_constraints
  WHERE constraint_name = 'sms_notification_logs_status_check'
),
status_diversity AS (
  SELECT 
    COUNT(DISTINCT status) as unique_statuses,
    SUM(CASE WHEN status NOT IN ('queued', 'sent', 'failed', 'skipped', 'simulated') THEN 1 ELSE 0 END) as clicksend_status_count
  FROM sms_notification_logs
  WHERE created_at > NOW() - INTERVAL '7 days'
)
SELECT 
  c.allows_arbitrary_values,
  s.unique_statuses,
  s.clicksend_status_count,
  CASE 
    WHEN c.allows_arbitrary_values AND s.clicksend_status_count > 0 
    THEN '✅ MIGRATION SUCCESSFUL - ClickSend statuses are being stored'
    WHEN c.allows_arbitrary_values 
    THEN '⚠️  MIGRATION APPLIED - No ClickSend statuses yet (may need to send test SMS)'
    ELSE '❌ MIGRATION NOT APPLIED - Constraint still uses old enum'
  END as overall_status
FROM constraint_check c
CROSS JOIN status_diversity s;

-- Expected output when everything is working:
-- allows_arbitrary_values: true
-- unique_statuses: 5+ (various statuses)
-- clicksend_status_count: 1+ (if SMS have been sent)
-- overall_status: ✅ MIGRATION SUCCESSFUL or ⚠️ MIGRATION APPLIED


-- ============================================================================
-- OPTIONAL: If migration was NOT applied, run this to apply it now
-- ============================================================================
/*
-- UNCOMMENT AND RUN THIS SECTION IF THE VERIFICATION FAILS:

-- Drop the old CHECK constraint
ALTER TABLE sms_notification_logs
  DROP CONSTRAINT IF EXISTS sms_notification_logs_status_check;

-- Add new CHECK constraint that allows any text value
ALTER TABLE sms_notification_logs
  ADD CONSTRAINT sms_notification_logs_status_check
  CHECK (status IS NOT NULL AND length(trim(status)) > 0);

-- Update the column comment to reflect the new allowed values
COMMENT ON COLUMN sms_notification_logs.status IS
  'ClickSend delivery status: SUCCESS, REGISTRATION_NEEDED, INVALID_NUMBER, queued (internal), failed (network error), skipped (user settings), simulated (dry-run). Stores the actual ClickSend API response status when available.';

-- Update existing "sent" records to show they're from before this migration
UPDATE sms_notification_logs
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{legacy_status}',
  '"sent"'::jsonb
)
WHERE status = 'sent'
  AND provider_message_sid IS NOT NULL
  AND metadata->>'clicksend_status' IS NULL;

SELECT '✅ Migration applied successfully!' as result;
*/
