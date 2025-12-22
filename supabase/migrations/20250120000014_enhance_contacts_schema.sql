/*
  # Enhance Contacts Schema for Manual Contact Management

  1. Changes
    - Add property_id to contacts table
    - Create contact_history table for tracking interactions
    - Add indexes for better performance

  2. Security
    - Enable RLS on new table
    - Add appropriate policies
*/

-- Add property_id to contacts table
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES properties(id) ON DELETE SET NULL;

-- Create contact_history table
CREATE TABLE IF NOT EXISTS contact_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  interaction_type text NOT NULL,
  interaction_date timestamptz NOT NULL DEFAULT now(),
  description text,
  notes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_interaction_type CHECK (
    interaction_type IN ('call', 'email', 'meeting', 'note', 'status_change', 'other')
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contacts_property_id ON contacts(property_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_contact_id ON contact_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_history_interaction_date ON contact_history(interaction_date);
CREATE INDEX IF NOT EXISTS idx_contact_history_created_by ON contact_history(created_by);

-- Enable RLS on contact_history
ALTER TABLE contact_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for contact_history
CREATE POLICY "Authenticated users can view contact history"
  ON contact_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage contact history"
  ON contact_history
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update the lead_management_view to include property information
CREATE OR REPLACE VIEW lead_management_view AS
SELECT 
  l.id as lead_id,
  l.form_id,
  lf.name as form_name,
  l.status_id,
  ls.name as status_name,
  ls.color as status_color,
  l.form_data,
  l.source_url,
  l.assigned_to,
  p.full_name as assigned_to_name,
  l.notes as lead_notes,
  l.created_at as lead_created_at,
  l.updated_at as lead_updated_at,
  c.id as contact_id,
  c.first_name,
  c.last_name,
  c.email,
  c.phone,
  c.company,
  c.job_title,
  c.address,
  c.property_id,
  prop.property_name as property_name,
  prop.address as property_address,
  c.tags,
  c.notes as contact_notes,
  c.last_contacted_at,
  c.created_at as contact_created_at,
  c.updated_at as contact_updated_at
FROM leads l
LEFT JOIN lead_forms lf ON l.form_id = lf.id
LEFT JOIN lead_statuses ls ON l.status_id = ls.id
LEFT JOIN profiles p ON l.assigned_to = p.id
LEFT JOIN contacts c ON l.id = c.lead_id
LEFT JOIN properties prop ON c.property_id = prop.id;

-- Grant permissions on the updated view
GRANT SELECT ON lead_management_view TO authenticated;
GRANT SELECT ON lead_management_view TO public;
