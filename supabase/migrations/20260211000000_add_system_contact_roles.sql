-- Add system contact role tracking columns to properties table
-- This allows us to track which system contact (CM, MS, AP, Primary) has which roles

-- Subcontractor contact (exclusive - only one can be true)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS community_manager_is_subcontractor boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS maintenance_supervisor_is_subcontractor boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS ap_is_subcontractor boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS primary_contact_is_subcontractor boolean DEFAULT false;

-- AR contact (exclusive - only one can be true)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS community_manager_is_ar boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS maintenance_supervisor_is_ar boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS ap_is_ar boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS primary_contact_is_ar boolean DEFAULT false;

-- Approval email recipients (multiple can be true)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS community_manager_is_approval_recipient boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS maintenance_supervisor_is_approval_recipient boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS ap_is_approval_recipient boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS primary_contact_is_approval_recipient boolean DEFAULT false;

-- Primary approval recipient (exclusive - only one can be true)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS community_manager_is_primary_approval boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS maintenance_supervisor_is_primary_approval boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS ap_is_primary_approval boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS primary_contact_is_primary_approval boolean DEFAULT false;

-- Notification email recipients (multiple can be true)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS community_manager_is_notification_recipient boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS maintenance_supervisor_is_notification_recipient boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS ap_is_notification_recipient boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS primary_contact_is_notification_recipient boolean DEFAULT false;

-- Primary notification recipient (exclusive - only one can be true)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS community_manager_is_primary_notification boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS maintenance_supervisor_is_primary_notification boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS ap_is_primary_notification boolean DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS primary_contact_is_primary_notification boolean DEFAULT false;

-- Add helpful comment
COMMENT ON COLUMN properties.community_manager_is_subcontractor IS 'Indicates if Community Manager is the Subcontractor Contact';
COMMENT ON COLUMN properties.community_manager_is_ar IS 'Indicates if Community Manager is the AR Contact';
COMMENT ON COLUMN properties.community_manager_is_approval_recipient IS 'Indicates if Community Manager receives approval emails';
COMMENT ON COLUMN properties.community_manager_is_primary_approval IS 'Indicates if Community Manager is the primary approval recipient';
COMMENT ON COLUMN properties.community_manager_is_notification_recipient IS 'Indicates if Community Manager receives notification emails';
COMMENT ON COLUMN properties.community_manager_is_primary_notification IS 'Indicates if Community Manager is the primary notification recipient';
