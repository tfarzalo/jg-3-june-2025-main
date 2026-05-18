-- Migration: add_sms_notification_settings_to_profiles
-- Adds per-event SMS notification toggle columns to the profiles table.
--
-- Design:
--   - Each notify_* column corresponds to a SmsNotificationEventKey
--   - Column names match the event → column mapping in dispatch-sms-notification
--   - Defaults vary by column (see comments below)
--   - Users can toggle these in the SMS Notification Settings UI

-- ─── Add SMS notification toggle columns ──────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notify_chat_received          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_job_assigned           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_charges_approved       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_work_order_submitted   boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_job_accepted           boolean NOT NULL DEFAULT true;

-- ─── Indexes for performance ──────────────────────────────────────────────────

-- Composite index for the dispatch-sms-notification eligibility check
-- (filters on sms_consent_given + role + specific notify_* column)
CREATE INDEX IF NOT EXISTS idx_profiles_sms_eligibility 
  ON profiles (sms_consent_given, role);

-- ─── Column comments ───────────────────────────────────────────────────────────

COMMENT ON COLUMN profiles.notify_chat_received IS
  'Receive SMS when a new chat message arrives. Default: false (opt-in required).';

COMMENT ON COLUMN profiles.notify_job_assigned IS
  'Receive SMS when assigned a new job (subcontractors). Default: true.';

COMMENT ON COLUMN profiles.notify_charges_approved IS
  'Receive SMS when extra charges are approved (subcontractors). Default: true.';

COMMENT ON COLUMN profiles.notify_work_order_submitted IS
  'Receive SMS when a work order is submitted (admin/JG management). Default: true.';

COMMENT ON COLUMN profiles.notify_job_accepted IS
  'Receive SMS when a subcontractor accepts a job (admin/JG management). Default: true.';
