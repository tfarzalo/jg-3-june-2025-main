-- ClickSend Migration: Clean Up Old Twilio SMS Logs
-- ═══════════════════════════════════════════════════════════════════════════
-- This script archives or removes old Twilio SMS logs from the sms_notification_logs table.
-- After ClickSend migration, we only want ClickSend data going forward.
--
-- Twilio message SIDs start with "SM" (e.g., SMeb59af1f406eeddb6f72176034fe411c)
-- ClickSend message IDs are UUIDs or different format
--
-- CHOOSE ONE OPTION BELOW:
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── OPTION 1: Archive Old Twilio Logs (RECOMMENDED) ────────────────────────
-- Keeps the data but marks it as archived in metadata
-- Allows you to exclude it from UI queries while preserving history

UPDATE sms_notification_logs
SET metadata = jsonb_set(
  jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{archived}',
    'true'::jsonb
  ),
  '{archived_reason}',
  '"Pre-ClickSend migration (Twilio data)"'::jsonb
)
WHERE provider_message_sid LIKE 'SM%'
  AND created_at < '2026-05-18 22:00:00+00'; -- Adjust to your migration time

-- Verify archived count
SELECT COUNT(*) as archived_count
FROM sms_notification_logs
WHERE metadata->>'archived' = 'true';


-- ─── OPTION 2: Delete Old Twilio Logs (PERMANENT!) ──────────────────────────
-- Permanently removes old Twilio data
-- ⚠️  USE WITH CAUTION - This cannot be undone!

-- Uncomment to execute:
/*
DELETE FROM sms_notification_logs
WHERE provider_message_sid LIKE 'SM%'
  AND created_at < '2026-05-18 22:00:00+00';

-- Verify deletion
SELECT COUNT(*) as remaining_logs
FROM sms_notification_logs;
*/


-- ─── OPTION 3: Clear ALL Logs and Start Fresh (NUCLEAR OPTION!) ─────────────
-- Completely wipes the sms_notification_logs table
-- ⚠️  ONLY use if you want a completely clean slate!

-- Uncomment to execute:
/*
TRUNCATE sms_notification_logs RESTART IDENTITY CASCADE;

-- Verify table is empty
SELECT COUNT(*) as total_logs FROM sms_notification_logs;
*/


-- ─── UPDATE SMS LOGS UI TO EXCLUDE ARCHIVED LOGS ─────────────────────────────
-- After archiving, you can modify the UI query to exclude archived logs
-- In SmsNotificationLogs.tsx, update the query to:
--
--   .from('sms_notification_logs_with_profile')
--   .select('...')
--   .or('metadata->archived.is.null,metadata->archived.eq.false')
--   .order('created_at', { ascending: false })
--   .limit(MAX_ROWS);
--


-- ─── STATISTICS: View Current Log Distribution ───────────────────────────────
-- Run this to see how many Twilio vs ClickSend logs you have

SELECT 
  CASE 
    WHEN provider_message_sid LIKE 'SM%' THEN 'Twilio (old)'
    WHEN provider_message_sid IS NULL THEN 'No provider ID'
    ELSE 'ClickSend (new)'
  END as provider_type,
  COUNT(*) as log_count,
  MIN(created_at) as first_log,
  MAX(created_at) as last_log
FROM sms_notification_logs
GROUP BY 
  CASE 
    WHEN provider_message_sid LIKE 'SM%' THEN 'Twilio (old)'
    WHEN provider_message_sid IS NULL THEN 'No provider ID'
    ELSE 'ClickSend (new)'
  END
ORDER BY last_log DESC;


-- ═══════════════════════════════════════════════════════════════════════════
-- RECOMMENDATION:
-- ═══════════════════════════════════════════════════════════════════════════
-- Use OPTION 1 (Archive) to preserve historical data while cleaning up the UI.
-- Then update the UI component to filter out archived logs.
-- ═══════════════════════════════════════════════════════════════════════════
