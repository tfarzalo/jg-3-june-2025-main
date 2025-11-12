/*
  # Enhance Contacts with Avatars and Improved Notes System

  1. Changes
    - Add avatar_url to contacts table
    - Create contact_notes table for individual dated notes
    - Create contact_communications table for communication log
    - Update lead statuses with proper colors
    - Add user assignment functionality

  2. Security
    - Enable RLS on new tables
    - Add appropriate policies
*/

-- Add avatar_url to contacts table
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create contact_notes table for individual dated notes
CREATE TABLE IF NOT EXISTS contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  note_text text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create contact_communications table for communication log
CREATE TABLE IF NOT EXISTS contact_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  communication_type text NOT NULL, -- 'call', 'email', 'meeting', 'text', 'other'
  subject text,
  notes text,
  communication_date timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Update lead statuses with better colors
UPDATE lead_statuses SET color = '#3B82F6' WHERE name = 'New Lead';
UPDATE lead_statuses SET color = '#F59E0B' WHERE name = 'Contacted';
UPDATE lead_statuses SET color = '#10B981' WHERE name = 'Qualified';
UPDATE lead_statuses SET color = '#8B5CF6' WHERE name = 'Proposal Sent';
UPDATE lead_statuses SET color = '#F97316' WHERE name = 'Negotiating';
UPDATE lead_statuses SET color = '#059669' WHERE name = 'Customer';
UPDATE lead_statuses SET color = '#047857' WHERE name = 'Closed Won';
UPDATE lead_statuses SET color = '#DC2626' WHERE name = 'Closed Lost';
UPDATE lead_statuses SET color = '#6B7280' WHERE name = 'Dead';

-- Add Manual Contact status
INSERT INTO lead_statuses (name, description, color, sort_order) VALUES
('Manual Contact', 'Manually created contact', '#6366F1', 0)
ON CONFLICT (name) DO UPDATE SET color = '#6366F1';

-- Enable RLS on new tables
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_communications ENABLE ROW LEVEL SECURITY;

-- RLS policies for contact_notes
CREATE POLICY "Users can view notes for their contacts"
  ON contact_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_notes.contact_id
      AND (contacts.assigned_to = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "Users can create notes for their contacts"
  ON contact_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_notes.contact_id
      AND (contacts.assigned_to = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "Users can update their own notes"
  ON contact_notes
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Users can delete their own notes"
  ON contact_notes
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR is_admin());

-- RLS policies for contact_communications
CREATE POLICY "Users can view communications for their contacts"
  ON contact_communications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_communications.contact_id
      AND (contacts.assigned_to = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "Users can create communications for their contacts"
  ON contact_communications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contacts
      WHERE contacts.id = contact_communications.contact_id
      AND (contacts.assigned_to = auth.uid() OR is_admin())
    )
  );

CREATE POLICY "Users can update their own communications"
  ON contact_communications
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "Users can delete their own communications"
  ON contact_communications
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR is_admin());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contact_notes_contact_id ON contact_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_created_at ON contact_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_contact_communications_contact_id ON contact_communications(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_communications_communication_date ON contact_communications(communication_date);

-- Update all_contacts_view to include avatar_url
-- Drop both views first to avoid any conflicts
DROP VIEW IF EXISTS lead_management_view CASCADE;
DROP VIEW IF EXISTS all_contacts_view CASCADE;

-- Recreate lead_management_view first
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

-- Grant permissions on lead_management_view
GRANT SELECT ON lead_management_view TO authenticated;
GRANT SELECT ON lead_management_view TO public;

-- Recreate all_contacts_view with proper column order
CREATE VIEW all_contacts_view AS
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

-- Grant permissions on the updated view
GRANT SELECT ON all_contacts_view TO authenticated;
GRANT SELECT ON all_contacts_view TO public;
