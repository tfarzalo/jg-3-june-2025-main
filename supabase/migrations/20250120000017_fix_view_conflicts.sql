/*
  # Fix View Conflicts and Add Avatar Support

  1. Changes
    - Safely drop and recreate views to avoid column conflicts
    - Add avatar_url to contacts table
    - Create contact_notes and contact_communications tables
    - Update lead statuses with proper colors

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
  communication_type text NOT NULL, -- e.g., 'call', 'email', 'meeting', 'text', 'other'
  subject text,
  notes text NOT NULL,
  communication_date timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_communications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contact_notes
CREATE POLICY "Users can view contact notes for contacts they have access to" ON contact_notes
  FOR SELECT USING (
    contact_id IN (
      SELECT c.id FROM contacts c
      WHERE c.assigned_to = auth.uid() 
         OR EXISTS (
           SELECT 1 FROM profiles p 
           WHERE p.id = auth.uid() 
           AND p.role IN ('admin', 'jg_management')
         )
    )
  );

CREATE POLICY "Users can insert contact notes for contacts they have access to" ON contact_notes
  FOR INSERT WITH CHECK (
    contact_id IN (
      SELECT c.id FROM contacts c
      WHERE c.assigned_to = auth.uid() 
         OR EXISTS (
           SELECT 1 FROM profiles p 
           WHERE p.id = auth.uid() 
           AND p.role IN ('admin', 'jg_management')
         )
    ) AND created_by = auth.uid()
  );

CREATE POLICY "Users can update contact notes they created" ON contact_notes
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete contact notes they created" ON contact_notes
  FOR DELETE USING (created_by = auth.uid());

-- RLS Policies for contact_communications
CREATE POLICY "Users can view contact communications for contacts they have access to" ON contact_communications
  FOR SELECT USING (
    contact_id IN (
      SELECT c.id FROM contacts c
      WHERE c.assigned_to = auth.uid() 
         OR EXISTS (
           SELECT 1 FROM profiles p 
           WHERE p.id = auth.uid() 
           AND p.role IN ('admin', 'jg_management')
         )
    )
  );

CREATE POLICY "Users can insert contact communications for contacts they have access to" ON contact_communications
  FOR INSERT WITH CHECK (
    contact_id IN (
      SELECT c.id FROM contacts c
      WHERE c.assigned_to = auth.uid() 
         OR EXISTS (
           SELECT 1 FROM profiles p 
           WHERE p.id = auth.uid() 
           AND p.role IN ('admin', 'jg_management')
         )
    ) AND created_by = auth.uid()
  );

CREATE POLICY "Users can update contact communications they created" ON contact_communications
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Users can delete contact communications they created" ON contact_communications
  FOR DELETE USING (created_by = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_notes_contact_id ON contact_notes(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_notes_created_at ON contact_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_contact_communications_contact_id ON contact_communications(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_communications_communication_date ON contact_communications(communication_date);

-- Update lead statuses with proper colors
INSERT INTO lead_statuses (name, description, color, sort_order) VALUES
  ('New Lead', 'Recently submitted lead', '#3B82F6', 1),
  ('Contacted', 'Initial contact made', '#8B5CF6', 2),
  ('Qualified', 'Lead meets qualification criteria', '#10B981', 3),
  ('Proposal Sent', 'Proposal or quote sent', '#F59E0B', 4),
  ('Negotiating', 'In negotiation phase', '#EF4444', 5),
  ('Customer', 'Converted to customer', '#059669', 6),
  ('Closed - Won', 'Successfully closed', '#10B981', 7),
  ('Closed - Lost', 'Lead did not convert', '#6B7280', 8),
  ('Dead', 'No longer active', '#EF4444', 9)
ON CONFLICT (name) DO UPDATE SET
  color = EXCLUDED.color,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- Safely drop and recreate views to avoid conflicts
-- First, check if views exist and drop them
DO $$
BEGIN
  -- Drop views if they exist
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'lead_management_view') THEN
    DROP VIEW lead_management_view CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_views WHERE viewname = 'all_contacts_view') THEN
    DROP VIEW all_contacts_view CASCADE;
  END IF;
END $$;

-- Recreate lead_management_view
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

-- Recreate all_contacts_view with avatar_url
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

-- Grant permissions on views
GRANT SELECT ON lead_management_view TO authenticated;
GRANT SELECT ON lead_management_view TO public;
GRANT SELECT ON all_contacts_view TO authenticated;
GRANT SELECT ON all_contacts_view TO public;

-- Grant permissions on new tables
GRANT SELECT, INSERT, UPDATE, DELETE ON contact_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON contact_communications TO authenticated;
