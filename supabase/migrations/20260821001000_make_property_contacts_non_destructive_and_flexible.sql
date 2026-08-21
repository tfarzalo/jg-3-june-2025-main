-- Keep existing property contact rows intact while supporting the newer
-- contact display and recipient flags used by the property contact UI.

ALTER TABLE public.property_contacts
ADD COLUMN IF NOT EXISTS is_primary_contact boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS receives_approval_emails boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS receives_notification_emails boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS custom_title text;

CREATE INDEX IF NOT EXISTS idx_property_contacts_primary_contact
ON public.property_contacts(property_id, is_primary_contact)
WHERE is_primary_contact = true;

-- Replace the older trigger behavior that treated job/department associations
-- as single-select. Only the true primary designations should be exclusive.
CREATE OR REPLACE FUNCTION public.enforce_property_contact_single_roles()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary_contact = true THEN
    UPDATE public.property_contacts
    SET is_primary_contact = false
    WHERE property_id = NEW.property_id
      AND id != NEW.id
      AND is_primary_contact = true;
  END IF;

  IF NEW.is_primary_approval_recipient = true THEN
    UPDATE public.property_contacts
    SET is_primary_approval_recipient = false
    WHERE property_id = NEW.property_id
      AND id != NEW.id
      AND is_primary_approval_recipient = true;

    NEW.is_approval_recipient := true;
    NEW.receives_approval_emails := true;
  END IF;

  IF NEW.is_primary_notification_recipient = true THEN
    UPDATE public.property_contacts
    SET is_primary_notification_recipient = false
    WHERE property_id = NEW.property_id
      AND id != NEW.id
      AND is_primary_notification_recipient = true;

    NEW.is_notification_recipient := true;
    NEW.receives_notification_emails := true;
  END IF;

  IF COALESCE(NEW.is_approval_recipient, false) = false
     AND COALESCE(NEW.receives_approval_emails, false) = false THEN
    NEW.is_primary_approval_recipient := false;
  END IF;

  IF COALESCE(NEW.is_notification_recipient, false) = false
     AND COALESCE(NEW.receives_notification_emails, false) = false THEN
    NEW.is_primary_notification_recipient := false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_property_contacts_single_roles ON public.property_contacts;
CREATE TRIGGER trg_property_contacts_single_roles
  BEFORE INSERT OR UPDATE ON public.property_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_property_contact_single_roles();

COMMENT ON COLUMN public.property_contacts.is_primary_contact IS
'Single-select: designates this custom contact as the property primary contact without duplicating the row.';

COMMENT ON COLUMN public.property_contacts.receives_approval_emails IS
'Multi-select display/compatibility flag for approval email recipients.';

COMMENT ON COLUMN public.property_contacts.receives_notification_emails IS
'Multi-select display/compatibility flag for notification email recipients.';

COMMENT ON COLUMN public.property_contacts.custom_title IS
'User-entered contact title used when position is Other or a more specific title is needed.';
