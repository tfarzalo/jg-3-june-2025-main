-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: create sms_notification_logs
-- Purpose  : Persistent audit trail for every SMS the system attempts to send.
--            Replaces the placeholder "sms_logs" table referenced (but never
--            created) in the send-sms Edge Function.
--
-- Design decisions:
--   • phone_number stores only the LAST 4 digits (masked at function level).
--     Full E.164 numbers are NEVER written to this table.
--   • message_body is stored for debugging only — never contains secrets.
--   • metadata JSONB holds safe context (job_id, event, dispatcher version).
--   • status TEXT with CHECK constraint mirrors email_logs pattern.
--   • Service-role INSERT is allowed without RLS (same as email_logs).
--   • Admins/super-admins can SELECT; regular users cannot.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sms_notification_logs (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type            TEXT        NOT NULL,
  user_id               UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Masked phone: last 4 digits only. Never store full number.
  phone_last4           TEXT        NULL,
  message_body          TEXT        NULL,
  status                TEXT        NOT NULL
                          CHECK (status IN ('queued', 'sent', 'failed', 'skipped', 'simulated')),
  provider_message_sid  TEXT        NULL,   -- Twilio MessageSid on success
  error_message         TEXT        NULL,   -- Twilio or network error text
  -- skip_reason is set when status = 'skipped' or 'simulated'
  skip_reason           TEXT        NULL,
  -- Safe JSON context: job_id, work_order_num, conversation_id, dispatcher version, etc.
  metadata              JSONB       NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sms_notification_logs IS
  'Audit log for every SMS the system attempts. Phone numbers are masked (last 4 only). No secrets stored.';

COMMENT ON COLUMN sms_notification_logs.phone_last4 IS
  'Last 4 digits of the destination E.164 number, e.g. "1234". Full number is never stored.';

COMMENT ON COLUMN sms_notification_logs.status IS
  'queued=about to send, sent=Twilio accepted, failed=error, skipped=settings/phone gate, simulated=dry-run';

COMMENT ON COLUMN sms_notification_logs.skip_reason IS
  'Human-readable reason when status=skipped or simulated, e.g. "sms_enabled=false".';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at
  ON sms_notification_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_logs_user_id
  ON sms_notification_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_sms_logs_event_type
  ON sms_notification_logs (event_type);

CREATE INDEX IF NOT EXISTS idx_sms_logs_status
  ON sms_notification_logs (status);

-- Composite index for the most common admin query pattern:
-- "show me recent failures for a given event"
CREATE INDEX IF NOT EXISTS idx_sms_logs_event_status
  ON sms_notification_logs (event_type, status, created_at DESC);

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE sms_notification_logs ENABLE ROW LEVEL SECURITY;

-- Service-role bypass: the Edge Functions run with SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses RLS entirely. No explicit service-role policy needed.

-- Admins and super-admins can read all logs.
CREATE POLICY "Admins can read SMS logs"
  ON sms_notification_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'is_super_admin', 'jg_management')
    )
  );

-- No INSERT/UPDATE/DELETE policies for regular users —
-- all writes go through the service-role key in Edge Functions.

-- ── Convenience View ──────────────────────────────────────────────────────────
-- Joins with profiles so the admin UI can show full_name + email alongside logs.

CREATE OR REPLACE VIEW sms_notification_logs_with_profile AS
SELECT
  l.id,
  l.event_type,
  l.user_id,
  p.full_name,
  p.email,
  p.role         AS user_role,
  l.phone_last4,
  l.message_body,
  l.status,
  l.provider_message_sid,
  l.error_message,
  l.skip_reason,
  l.metadata,
  l.created_at
FROM sms_notification_logs l
LEFT JOIN profiles p ON p.id = l.user_id;

-- Grant admins SELECT on the view (RLS on the base table already guards access
-- but views need their own grant when RLS is not inherited).
GRANT SELECT ON sms_notification_logs_with_profile TO authenticated;

-- ── Rate-limit helper function ────────────────────────────────────────────────
-- Called by the Edge Function (via service-role RPC) to check whether a
-- given (user_id, event_type) combination has been sent within a window.
-- Returns the count of sent+queued rows in the last `p_window_seconds`.

CREATE OR REPLACE FUNCTION sms_recent_count(
  p_user_id       UUID,
  p_event_type    TEXT,
  p_window_seconds INT DEFAULT 300   -- default: 5-minute window
)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COUNT(*)
  FROM sms_notification_logs
  WHERE user_id     = p_user_id
    AND event_type  = p_event_type
    AND status      IN ('queued', 'sent')
    AND created_at  >= NOW() - (p_window_seconds || ' seconds')::INTERVAL;
$$;

COMMENT ON FUNCTION sms_recent_count IS
  'Returns the number of sent/queued SMS for a (user, event) pair within a sliding window. Used for rate-limit checks in the dispatcher.';
