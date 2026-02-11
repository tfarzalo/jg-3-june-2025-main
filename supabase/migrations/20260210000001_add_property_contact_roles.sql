-- =====================================================
-- Property Contact Roles & Email Recipients Enhancement
-- Migration: 20260210000001_add_property_contact_roles.sql
-- =====================================================
-- This migration adds role-based flags to property_contacts
-- to support flexible contact management and email recipient selection
-- WITHOUT breaking existing functionality.

-- Add secondary_email column if it doesn't exist (backward compatibility)
ALTER TABLE public.property_contacts 
ADD COLUMN IF NOT EXISTS secondary_email text;

-- Add role/recipient flag columns
ALTER TABLE public.property_contacts 
ADD COLUMN IF NOT EXISTS is_subcontractor_contact boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_accounts_receivable_contact boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_approval_recipient boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_notification_recipient boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_primary_approval_recipient boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_primary_notification_recipient boolean NOT NULL DEFAULT false;

-- Add contact_role_config to properties for system contact role assignments
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS contact_role_config jsonb DEFAULT '{}'::jsonb;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_property_contacts_property_id 
ON public.property_contacts(property_id);

CREATE INDEX IF NOT EXISTS idx_property_contacts_approval_recipients 
ON public.property_contacts(property_id, is_approval_recipient) 
WHERE is_approval_recipient = true;

CREATE INDEX IF NOT EXISTS idx_property_contacts_notification_recipients 
ON public.property_contacts(property_id, is_notification_recipient) 
WHERE is_notification_recipient = true;

CREATE INDEX IF NOT EXISTS idx_property_contacts_subcontractor 
ON public.property_contacts(property_id, is_subcontractor_contact) 
WHERE is_subcontractor_contact = true;

CREATE INDEX IF NOT EXISTS idx_property_contacts_ar 
ON public.property_contacts(property_id, is_accounts_receivable_contact) 
WHERE is_accounts_receivable_contact = true;

-- =====================================================
-- TRIGGER: Enforce single-select constraints
-- =====================================================
-- Ensure only ONE contact per property can have specific roles

CREATE OR REPLACE FUNCTION public.enforce_property_contact_single_roles()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting is_subcontractor_contact to true, unset others
  IF NEW.is_subcontractor_contact = true THEN
    UPDATE public.property_contacts
    SET is_subcontractor_contact = false
    WHERE property_id = NEW.property_id
      AND id != NEW.id
      AND is_subcontractor_contact = true;
  END IF;

  -- If setting is_accounts_receivable_contact to true, unset others
  IF NEW.is_accounts_receivable_contact = true THEN
    UPDATE public.property_contacts
    SET is_accounts_receivable_contact = false
    WHERE property_id = NEW.property_id
      AND id != NEW.id
      AND is_accounts_receivable_contact = true;
  END IF;

  -- If setting is_primary_approval_recipient to true:
  -- 1) Unset other primaries
  -- 2) Automatically set is_approval_recipient to true
  IF NEW.is_primary_approval_recipient = true THEN
    UPDATE public.property_contacts
    SET is_primary_approval_recipient = false
    WHERE property_id = NEW.property_id
      AND id != NEW.id
      AND is_primary_approval_recipient = true;
    
    NEW.is_approval_recipient := true;
  END IF;

  -- If setting is_primary_notification_recipient to true:
  -- 1) Unset other primaries
  -- 2) Automatically set is_notification_recipient to true
  IF NEW.is_primary_notification_recipient = true THEN
    UPDATE public.property_contacts
    SET is_primary_notification_recipient = false
    WHERE property_id = NEW.property_id
      AND id != NEW.id
      AND is_primary_notification_recipient = true;
    
    NEW.is_notification_recipient := true;
  END IF;

  -- If unsetting is_approval_recipient, also unset primary
  IF NEW.is_approval_recipient = false AND OLD.is_approval_recipient = true THEN
    NEW.is_primary_approval_recipient := false;
  END IF;

  -- If unsetting is_notification_recipient, also unset primary
  IF NEW.is_notification_recipient = false AND OLD.is_notification_recipient = true THEN
    NEW.is_primary_notification_recipient := false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trg_property_contacts_single_roles ON public.property_contacts;
CREATE TRIGGER trg_property_contacts_single_roles
  BEFORE INSERT OR UPDATE ON public.property_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_property_contact_single_roles();

-- =====================================================
-- COMMENT Documentation
-- =====================================================
COMMENT ON COLUMN public.property_contacts.is_subcontractor_contact IS 
'Single-select: designates this contact as the primary subcontractor contact for the property';

COMMENT ON COLUMN public.property_contacts.is_accounts_receivable_contact IS 
'Single-select: designates this contact as the AR/AP contact for billing purposes';

COMMENT ON COLUMN public.property_contacts.is_approval_recipient IS 
'Multi-select: this contact receives approval emails (can be in CC if not primary)';

COMMENT ON COLUMN public.property_contacts.is_notification_recipient IS 
'Multi-select: this contact receives notification emails (can be in CC if not primary)';

COMMENT ON COLUMN public.property_contacts.is_primary_approval_recipient IS 
'Single-select within approval recipients: this contact is the primary To recipient for approval emails';

COMMENT ON COLUMN public.property_contacts.is_primary_notification_recipient IS 
'Single-select within notification recipients: this contact is the primary To recipient for notification emails';

COMMENT ON COLUMN public.properties.contact_role_config IS 
'JSON config storing role assignments for system contacts (community_manager, maintenance_supervisor, primary_contact, ap). Structure: { "community_manager": { "approvalRecipient": true, "primaryApproval": false, ... }, ... }';
