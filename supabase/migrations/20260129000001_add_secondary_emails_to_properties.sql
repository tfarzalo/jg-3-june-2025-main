ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS community_manager_secondary_email text,
  ADD COLUMN IF NOT EXISTS maintenance_supervisor_secondary_email text,
  ADD COLUMN IF NOT EXISTS primary_contact_secondary_email text,
  ADD COLUMN IF NOT EXISTS ap_secondary_email text;
