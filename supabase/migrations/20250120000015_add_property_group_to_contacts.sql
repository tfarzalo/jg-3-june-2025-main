/*
  # Add Property Group Field to Contacts

  1. Changes
    - Add property_group field to contacts table
    - Update lead_management_view to include property_group
    - Add function to create property from contact data

  2. Security
    - Maintain existing RLS policies
*/

-- Add property fields to contacts table
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS property_group text;

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id) ON DELETE SET NULL;

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS property_name text;

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS property_address text;

-- Drop and recreate lead_management_view to include property fields
DROP VIEW IF EXISTS lead_management_view;

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

-- Create function to create property from contact data
CREATE OR REPLACE FUNCTION create_property_from_contact(
  contact_id_param uuid,
  property_name_param text,
  property_address_param text,
  property_group_param text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  new_property_id uuid;
  contact_record contacts%ROWTYPE;
  pmg_id uuid;
BEGIN
  -- Get contact data
  SELECT * INTO contact_record FROM contacts WHERE id = contact_id_param;
  
  IF contact_record IS NULL THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  -- Create property management group if property_group is provided and doesn't exist
  IF property_group_param IS NOT NULL AND property_group_param != '' THEN
    -- Check if property management group exists
    SELECT id INTO pmg_id FROM property_management_groups 
    WHERE company_name = property_group_param;
    
    -- Create if doesn't exist
    IF pmg_id IS NULL THEN
      INSERT INTO property_management_groups (company_name)
      VALUES (property_group_param)
      RETURNING id INTO pmg_id;
    END IF;
  END IF;

  -- Create the property
  INSERT INTO properties (
    property_name,
    address,
    property_management_group_id,
    created_at,
    updated_at
  ) VALUES (
    property_name_param,
    property_address_param,
    pmg_id,
    now(),
    now()
  ) RETURNING id INTO new_property_id;

  -- Update contact with property_id
  UPDATE contacts 
  SET 
    property_id = new_property_id,
    property_group = property_group_param,
    updated_at = now()
  WHERE id = contact_id_param;

  RETURN new_property_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_property_from_contact TO authenticated;

-- Create a comprehensive contacts view that includes all contacts
CREATE OR REPLACE VIEW all_contacts_view AS
SELECT
  c.id AS contact_id,
  c.lead_id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.company,
  c.job_title,
  c.property_id,
  c.property_name,
  c.property_address,
  c.property_group,
  c.address,
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

-- Grant permissions on the new view
GRANT SELECT ON all_contacts_view TO authenticated;
GRANT SELECT ON all_contacts_view TO public;
