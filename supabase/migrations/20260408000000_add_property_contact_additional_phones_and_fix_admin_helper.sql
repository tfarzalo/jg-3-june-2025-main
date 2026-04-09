-- Add multi-phone support for property contacts and system contact fields,
-- and ensure super admins inherit admin/management RLS access.

ALTER TABLE public.property_contacts
ADD COLUMN IF NOT EXISTS additional_phones jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS community_manager_additional_phones jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS maintenance_supervisor_additional_phones jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS primary_contact_additional_phones jsonb NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ap_additional_phones jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.property_contacts.additional_phones IS
'Additional phone numbers for a custom property contact, stored as a JSON array of formatted phone strings.';

COMMENT ON COLUMN public.properties.community_manager_additional_phones IS
'Additional phone numbers for the community manager system contact, stored as a JSON array of formatted phone strings.';

COMMENT ON COLUMN public.properties.maintenance_supervisor_additional_phones IS
'Additional phone numbers for the maintenance supervisor system contact, stored as a JSON array of formatted phone strings.';

COMMENT ON COLUMN public.properties.primary_contact_additional_phones IS
'Additional phone numbers for the primary contact system contact, stored as a JSON array of formatted phone strings.';

COMMENT ON COLUMN public.properties.ap_additional_phones IS
'Additional phone numbers for the accounts payable system contact, stored as a JSON array of formatted phone strings.';

CREATE OR REPLACE FUNCTION public.is_admin_or_management()
RETURNS BOOLEAN AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.user_roles ur ON ura.role_id = ur.id
    WHERE ura.user_id = auth.uid()
      AND ur.name IN ('Admin', 'JG Management', 'Super Admin')
  ) THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'jg_management', 'is_super_admin')
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
