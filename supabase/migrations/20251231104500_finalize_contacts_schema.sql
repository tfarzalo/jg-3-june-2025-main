ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS primary_contact_name text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS primary_contact_phone text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS primary_contact_role text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS community_manager_title text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS maintenance_supervisor_title text;
ALTER TABLE public.properties ALTER COLUMN community_manager_title SET DEFAULT 'Community Manager';
ALTER TABLE public.properties ALTER COLUMN maintenance_supervisor_title SET DEFAULT 'Maintenance Supervisor';

CREATE TABLE IF NOT EXISTS public.property_contacts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  position text,
  name text,
  email text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.property_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS property_contacts_read_all ON public.property_contacts;
DROP POLICY IF EXISTS property_contacts_modify_admin_management ON public.property_contacts;
CREATE POLICY property_contacts_read_all ON public.property_contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY property_contacts_modify_admin_management ON public.property_contacts FOR ALL TO authenticated USING (public.is_admin_or_management()) WITH CHECK (public.is_admin_or_management());
