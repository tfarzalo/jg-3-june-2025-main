-- Migration: Add admin-specific SMS notification settings
-- Purpose: Allow Admin/SuperAdmin users to receive system-wide SMS notifications
--          for events like job acceptances, work order submissions, and charge approvals
--
-- Background:
--   - Admins need to be notified when ANY subcontractor performs certain actions
--   - Subcontractors should only be notified about their own assigned jobs
--   - Chat notifications remain direct (specific recipient only)
--
-- New columns (admin-only):
--   • notify_admin_job_accepted - Notify when ANY subcontractor accepts a job
--   • notify_admin_work_order_submitted - Notify when ANY subcontractor submits a work order
--   • notify_admin_charges_approved - Notify when extra charges are approved on ANY job

-- Add admin notification columns
ALTER TABLE user_sms_notification_settings
  ADD COLUMN IF NOT EXISTS notify_admin_job_accepted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_admin_work_order_submitted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_admin_charges_approved BOOLEAN DEFAULT false;

-- Add column comments
COMMENT ON COLUMN user_sms_notification_settings.notify_admin_job_accepted IS
  'Admin/SuperAdmin only: Receive SMS when ANY subcontractor accepts a job. Ignored for non-admin users.';

COMMENT ON COLUMN user_sms_notification_settings.notify_admin_work_order_submitted IS
  'Admin/SuperAdmin only: Receive SMS when ANY subcontractor submits a work order. Ignored for non-admin users.';

COMMENT ON COLUMN user_sms_notification_settings.notify_admin_charges_approved IS
  'Admin/SuperAdmin only: Receive SMS when extra charges are approved on ANY job. Ignored for non-admin users.';

-- Enable these settings by default for existing admin users
UPDATE user_sms_notification_settings
SET 
  notify_admin_job_accepted = true,
  notify_admin_work_order_submitted = true,
  notify_admin_charges_approved = true
WHERE user_id IN (
  SELECT id
  FROM profiles
  WHERE role IN ('admin', 'is_super_admin', 'jg_management')
);

-- For new admin users, create a trigger to set these defaults
CREATE OR REPLACE FUNCTION set_admin_sms_notification_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the user is an admin
  IF NEW.role IN ('admin', 'is_super_admin', 'jg_management') THEN
    -- Update their SMS notification settings if they exist
    UPDATE user_sms_notification_settings
    SET 
      notify_admin_job_accepted = true,
      notify_admin_work_order_submitted = true,
      notify_admin_charges_approved = true
    WHERE user_id = NEW.id;
    
    -- If no settings row exists yet, it will be created by the INSERT trigger
    -- with these defaults when the user first accesses settings
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on profiles table when role is updated to admin
DROP TRIGGER IF EXISTS on_profile_role_change_set_admin_sms_defaults ON profiles;
CREATE TRIGGER on_profile_role_change_set_admin_sms_defaults
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  WHEN (NEW.role IN ('admin', 'is_super_admin', 'jg_management') AND (OLD.role IS DISTINCT FROM NEW.role))
  EXECUTE FUNCTION set_admin_sms_notification_defaults();

-- Grant permissions (settings table is already accessible to authenticated users via RLS)
-- No additional grants needed

-- Verification query (run after migration to confirm)
-- SELECT 
--   p.full_name,
--   p.role,
--   s.notify_admin_job_accepted,
--   s.notify_admin_work_order_submitted,
--   s.notify_admin_charges_approved
-- FROM profiles p
-- LEFT JOIN user_sms_notification_settings s ON s.user_id = p.id
-- WHERE p.role IN ('admin', 'is_super_admin', 'jg_management')
-- ORDER BY p.full_name;
