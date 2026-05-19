-- Migration: Allow ClickSend status values in sms_notification_logs
-- Purpose: Store actual ClickSend API status responses (SUCCESS, REGISTRATION_NEEDED, etc.)
--          instead of generic "sent"/"failed" values
--
-- ClickSend returns statuses like:
--   • SUCCESS - Message queued/sent successfully
--   • REGISTRATION_NEEDED - Phone number requires registration
--   • INVALID_NUMBER - Phone number is invalid
--   • And others...
--
-- By storing the actual ClickSend status, we get much better visibility into
-- why messages aren't being delivered.

-- Drop the old CHECK constraint
ALTER TABLE sms_notification_logs
  DROP CONSTRAINT IF EXISTS sms_notification_logs_status_check;

-- Add new CHECK constraint that allows any text value
-- We still want to ensure it's not null/empty, but allow any ClickSend status
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

-- For reference, common ClickSend status values include:
-- SUCCESS - Message successfully queued/sent
-- REGISTRATION_NEEDED - Phone number needs to be registered (trial accounts)
-- INVALID_NUMBER - Phone number is invalid
-- OPTED_OUT - Recipient has opted out
-- CARRIER_FAILURE - Carrier rejected the message
-- And others documented at: https://developers.clicksend.com/docs/rest/v3/
