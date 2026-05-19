-- ClickSend SMS Queue + Delivery Tracking Schema
-- Creates the queue table used by dispatch-sms-notification/process-sms-queue
-- and adds the delivery-status columns consumed by send-sms, webhooks, and UI.

CREATE TABLE IF NOT EXISTS sms_notification_queue (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type            TEXT NOT NULL,
  user_id               UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  phone_number          TEXT NOT NULL,
  message_body          TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  retry_count           INTEGER NOT NULL DEFAULT 0,
  max_retries           INTEGER NOT NULL DEFAULT 3,
  next_attempt_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  job_id                UUID NULL,
  work_order_id         UUID NULL,
  conversation_id       UUID NULL,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  provider_message_sid  TEXT NULL,
  error_message         TEXT NULL,
  log_id                UUID NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_queue_pending
  ON sms_notification_queue (status, next_attempt_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_sms_queue_user_event_created
  ON sms_notification_queue (user_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_queue_conversation
  ON sms_notification_queue (conversation_id)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE sms_notification_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read SMS queue" ON sms_notification_queue;
CREATE POLICY "Admins can read SMS queue"
  ON sms_notification_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'is_super_admin', 'jg_management')
    )
  );

GRANT SELECT ON sms_notification_queue TO authenticated;

ALTER TABLE sms_notification_logs
  ADD COLUMN IF NOT EXISTS provider_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS last_status_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS queue_id UUID NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_sms_logs_queue_id
  ON sms_notification_logs (queue_id)
  WHERE queue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_logs_provider_message_sid
  ON sms_notification_logs (provider_message_sid)
  WHERE provider_message_sid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_logs_last_status_at
  ON sms_notification_logs (last_status_at DESC)
  WHERE last_status_at IS NOT NULL;

CREATE OR REPLACE FUNCTION update_sms_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_sms_notification_queue_updated_at ON sms_notification_queue;
CREATE TRIGGER update_sms_notification_queue_updated_at
  BEFORE UPDATE ON sms_notification_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_updated_at();

DROP TRIGGER IF EXISTS update_sms_notification_logs_updated_at ON sms_notification_logs;
CREATE TRIGGER update_sms_notification_logs_updated_at
  BEFORE UPDATE ON sms_notification_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_updated_at();

CREATE OR REPLACE VIEW sms_notification_logs_with_profile AS
SELECT
  l.id,
  l.event_type,
  l.user_id,
  p.full_name,
  p.email,
  p.role AS user_role,
  l.phone_last4,
  l.message_body,
  l.status,
  l.provider_message_sid,
  l.provider_status,
  l.error_message,
  l.skip_reason,
  l.delivered_at,
  l.failed_at,
  l.last_status_at,
  l.queue_id,
  l.metadata,
  l.created_at
FROM sms_notification_logs l
LEFT JOIN profiles p ON p.id = l.user_id;

GRANT SELECT ON sms_notification_logs_with_profile TO authenticated;
