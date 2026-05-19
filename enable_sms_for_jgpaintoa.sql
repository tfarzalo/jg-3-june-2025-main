-- Enable SMS notifications for jgpaintoa@gmail.com
-- ═══════════════════════════════════════════════════════════════════════════
-- This script:
-- 1. Sets SMS phone number to +19804184113 (E.164 format)
-- 2. Enables SMS consent (sms_consent_given = true)
-- 3. Enables all SMS notification types in user_sms_notification_settings
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1: Update profiles table with phone number and consent
UPDATE profiles
SET 
  sms_phone = '+19804184113',
  sms_consent_given = true,
  sms_consent_given_at = NOW(),
  sms_consent_ip = '127.0.0.1'  -- Replace with actual IP if needed
WHERE email = 'jgpaintoa@gmail.com';

-- Step 2: Update user_sms_notification_settings to enable all notification types
-- First, get the user_id for this email
DO $$
DECLARE
  target_user_id UUID;
BEGIN
  -- Get the user ID
  SELECT id INTO target_user_id
  FROM profiles
  WHERE email = 'jgpaintoa@gmail.com';

  -- If user exists, update or insert SMS settings
  IF target_user_id IS NOT NULL THEN
    -- Try to update existing settings
    UPDATE user_sms_notification_settings
    SET 
      notify_chat_received = true,
      notify_job_assigned = true,
      notify_charges_approved = true,
      notify_work_order_submitted = true,
      notify_job_accepted = true,
      updated_at = NOW()
    WHERE user_id = target_user_id;

    -- If no rows were updated, insert new settings
    IF NOT FOUND THEN
      INSERT INTO user_sms_notification_settings (
        user_id,
        notify_chat_received,
        notify_job_assigned,
        notify_charges_approved,
        notify_work_order_submitted,
        notify_job_accepted,
        created_at,
        updated_at
      ) VALUES (
        target_user_id,
        true,
        true,
        true,
        true,
        true,
        NOW(),
        NOW()
      );
    END IF;

    RAISE NOTICE 'SMS settings updated for user: %', target_user_id;
  ELSE
    RAISE NOTICE 'User with email jgpaintoa@gmail.com not found';
  END IF;
END $$;

-- Step 3: Verify the changes
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.sms_phone,
  p.sms_consent_given,
  p.sms_consent_given_at,
  uss.notify_chat_received,
  uss.notify_job_assigned,
  uss.notify_charges_approved,
  uss.notify_work_order_submitted,
  uss.notify_job_accepted
FROM profiles p
LEFT JOIN user_sms_notification_settings uss ON uss.user_id = p.id
WHERE p.email = 'jgpaintoa@gmail.com';

-- Expected output:
-- ┌──────────────────────────────────┬───────────────────┬───────────┬──────────────┬──────────────────┬──────────────────────┬────────────────────┬──────────────────┬──────────────────────┬────────────────────────────┬──────────────────────┐
-- │ id                               │ email             │ full_name │ sms_phone    │ sms_consent_given│ sms_consent_given_at │ notify_chat_received│ notify_job_assigned│ notify_charges_approved│ notify_work_order_submitted│ notify_job_accepted  │
-- ├──────────────────────────────────┼───────────────────┼───────────┼──────────────┼──────────────────┼──────────────────────┼────────────────────┼──────────────────┼──────────────────────┼────────────────────────────┼──────────────────────┤
-- │ <uuid>                           │ jgpaintoa@gmail.com│ ...       │ +19804184113 │ true             │ <timestamp>          │ true               │ true             │ true                 │ true                       │ true                 │
-- └──────────────────────────────────┴───────────────────┴───────────┴──────────────┴──────────────────┴──────────────────────┴────────────────────┴──────────────────┴──────────────────────┴────────────────────────────┴──────────────────────┘
