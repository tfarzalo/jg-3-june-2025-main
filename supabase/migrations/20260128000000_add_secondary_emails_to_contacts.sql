-- Add secondary email support for contacts and property contacts.
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS secondary_email text;
ALTER TABLE public.property_contacts ADD COLUMN IF NOT EXISTS secondary_email text;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'lead_management_view') THEN
    DROP VIEW lead_management_view CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'all_contacts_view') THEN
    DROP VIEW all_contacts_view CASCADE;
  END IF;
END
$$;

-- Recreate lead_management_view with secondary_email included
CREATE VIEW lead_management_view AS
SELECT
  l.id AS lead_id,
  c.id AS contact_id,
  lf.id AS form_id,
  lf.name AS form_name,
  ls.name AS status_name,
  ls.color AS status_color,
  c.first_name,
  c.last_name,
  c.email,
  c.secondary_email,
  c.phone,
  c.company,
  c.job_title,
  c.notes AS contact_notes,
  l.notes AS lead_notes,
  c.tags,
  p.full_name AS assigned_to_name,
  c.last_contacted_at,
  l.created_at AS lead_created_at,
  c.created_at AS contact_created_at,
  c.updated_at AS contact_updated_at,
  c.address,
  c.property_id,
  c.property_name,
  c.property_address,
  c.property_group
FROM leads l
LEFT JOIN lead_forms lf ON l.form_id = lf.id
LEFT JOIN lead_statuses ls ON l.status_id = ls.id
LEFT JOIN contacts c ON l.id = c.lead_id
LEFT JOIN profiles p ON c.assigned_to = p.id;

-- Recreate all_contacts_view with secondary_email
CREATE VIEW all_contacts_view AS
SELECT
  c.id AS contact_id,
  c.lead_id,
  c.first_name,
  c.last_name,
  c.email,
  c.secondary_email,
  c.phone,
  c.company,
  c.job_title,
  c.property_id,
  c.property_name,
  c.property_address,
  c.property_group,
  c.address,
  c.avatar_url,
  c.tags,
  c.notes AS contact_notes,
  c.assigned_to,
  p.full_name AS assigned_to_name,
  c.last_contacted_at,
  c.created_at AS contact_created_at,
  c.updated_at AS contact_updated_at,
  -- Lead information (if exists)
  l.id AS lead_id_exists,
  lf.name AS form_name,
  ls.name AS status_name,
  ls.color AS status_color,
  l.notes AS lead_notes,
  l.created_at AS lead_created_at,
  CASE
    WHEN c.lead_id IS NOT NULL THEN 'Form Lead'
    ELSE 'Manual Contact'
  END AS contact_type
FROM contacts c
LEFT JOIN leads l ON c.lead_id = l.id
LEFT JOIN lead_forms lf ON l.form_id = lf.id
LEFT JOIN lead_statuses ls ON l.status_id = ls.id
LEFT JOIN profiles p ON c.assigned_to = p.id;

-- Reinstate permissions on the refreshed views
GRANT SELECT ON lead_management_view TO authenticated;
GRANT SELECT ON lead_management_view TO public;
GRANT SELECT ON all_contacts_view TO authenticated;
GRANT SELECT ON all_contacts_view TO public;
