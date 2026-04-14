-- Migration: add_sms_consent_to_profiles
-- Adds TCPA-compliant SMS consent tracking columns to the profiles table.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS sms_consent_given     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_consent_given_at  timestamptz,
  ADD COLUMN IF NOT EXISTS sms_consent_ip        text;

-- Index for quick consent lookups (e.g. dispatch-sms-notification gate)
CREATE INDEX IF NOT EXISTS idx_profiles_sms_consent ON profiles (sms_consent_given);

COMMENT ON COLUMN profiles.sms_consent_given    IS 'User has explicitly agreed to receive SMS notifications from JG Painting Pros, Inc.';
COMMENT ON COLUMN profiles.sms_consent_given_at IS 'Timestamp when SMS consent was granted';
COMMENT ON COLUMN profiles.sms_consent_ip       IS 'IP address recorded at time of consent (TCPA compliance)';
