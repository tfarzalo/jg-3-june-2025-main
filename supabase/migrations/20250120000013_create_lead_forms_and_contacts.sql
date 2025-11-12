/*
  # Create Lead Forms and Contact Management System

  1. New Tables
    - `lead_forms` - Stores form configurations created by admins
    - `lead_form_fields` - Stores individual form fields for each form
    - `leads` - Stores submitted lead data
    - `lead_statuses` - Defines available lead statuses
    - `contacts` - Stores contact information and lead management data

  2. Security
    - Enable RLS on all tables
    - Add policies for proper access control
    - Only admins can manage forms and form fields
    - Authenticated users can view and manage leads/contacts
*/

-- Create lead_statuses table first (reference table)
CREATE TABLE IF NOT EXISTS lead_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text DEFAULT '#6B7280',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default lead statuses
INSERT INTO lead_statuses (name, description, color, sort_order) VALUES
('New Lead', 'Freshly submitted lead', '#3B82F6', 1),
('Contacted', 'Initial contact made', '#F59E0B', 2),
('Qualified', 'Lead qualified for services', '#10B981', 3),
('Proposal Sent', 'Proposal or estimate sent', '#8B5CF6', 4),
('Negotiating', 'In negotiation phase', '#F97316', 5),
('Customer', 'Converted to paying customer', '#059669', 6),
('Closed Won', 'Successfully closed deal', '#047857', 7),
('Closed Lost', 'Deal lost or declined', '#DC2626', 8),
('Dead', 'Lead is no longer active', '#6B7280', 9)
ON CONFLICT (name) DO NOTHING;

-- Create lead_forms table
CREATE TABLE IF NOT EXISTS lead_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  success_message text DEFAULT 'Thank you for your submission!',
  redirect_url text,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create lead_form_fields table
CREATE TABLE IF NOT EXISTS lead_form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES lead_forms(id) ON DELETE CASCADE,
  field_type text NOT NULL,
  field_name text NOT NULL,
  field_label text NOT NULL,
  placeholder text,
  is_required boolean DEFAULT false,
  options jsonb, -- For select, radio, checkbox options
  validation_rules jsonb, -- For custom validation
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_field_type CHECK (
    field_type IN ('text', 'email', 'phone', 'textarea', 'select', 'radio', 'checkbox', 'number', 'date', 'url')
  )
);

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES lead_forms(id) ON DELETE CASCADE,
  status_id uuid NOT NULL REFERENCES lead_statuses(id) ON DELETE RESTRICT,
  form_data jsonb NOT NULL, -- Stores all form field data
  source_url text,
  ip_address inet,
  user_agent text,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create contacts table (for lead management)
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  email text,
  phone text,
  company text,
  job_title text,
  address jsonb, -- Store address components
  notes text,
  tags text[], -- Array of tags for categorization
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  last_contacted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lead_forms_created_by ON lead_forms(created_by);
CREATE INDEX IF NOT EXISTS idx_lead_forms_is_active ON lead_forms(is_active);
CREATE INDEX IF NOT EXISTS idx_lead_form_fields_form_id ON lead_form_fields(form_id);
CREATE INDEX IF NOT EXISTS idx_lead_form_fields_sort_order ON lead_form_fields(form_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_leads_form_id ON leads(form_id);
CREATE INDEX IF NOT EXISTS idx_leads_status_id ON leads(status_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_id ON contacts(lead_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING GIN(tags);

-- Enable RLS on all tables
ALTER TABLE lead_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for lead_statuses
CREATE POLICY "Anyone can view lead statuses"
  ON lead_statuses
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage lead statuses"
  ON lead_statuses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for lead_forms
CREATE POLICY "Anyone can view active lead forms"
  ON lead_forms
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Authenticated users can view all lead forms"
  ON lead_forms
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage lead forms"
  ON lead_forms
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for lead_form_fields
CREATE POLICY "Anyone can view form fields for active forms"
  ON lead_form_fields
  FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM lead_forms
      WHERE id = form_id AND is_active = true
    )
  );

CREATE POLICY "Authenticated users can view all form fields"
  ON lead_form_fields
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage form fields"
  ON lead_form_fields
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for leads
CREATE POLICY "Anyone can insert leads"
  ON leads
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Authenticated users can view leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update leads"
  ON leads
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can delete leads"
  ON leads
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create RLS policies for contacts
CREATE POLICY "Authenticated users can view contacts"
  ON contacts
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage contacts"
  ON contacts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to automatically create contact from lead
CREATE OR REPLACE FUNCTION create_contact_from_lead()
RETURNS TRIGGER AS $$
DECLARE
  contact_data jsonb;
  first_name_val text;
  last_name_val text;
  email_val text;
  phone_val text;
  company_val text;
BEGIN
  -- Extract common fields from form_data
  contact_data := NEW.form_data;
  
  -- Try to extract name fields (handle various field names)
  first_name_val := COALESCE(
    contact_data->>'first_name',
    contact_data->>'firstName',
    contact_data->>'firstname',
    contact_data->>'fname',
    split_part(COALESCE(contact_data->>'name', contact_data->>'full_name', ''), ' ', 1)
  );
  
  last_name_val := COALESCE(
    contact_data->>'last_name',
    contact_data->>'lastName',
    contact_data->>'lastname',
    contact_data->>'lname',
    split_part(COALESCE(contact_data->>'name', contact_data->>'full_name', ''), ' ', 2)
  );
  
  email_val := COALESCE(
    contact_data->>'email',
    contact_data->>'e_mail',
    contact_data->>'email_address'
  );
  
  phone_val := COALESCE(
    contact_data->>'phone',
    contact_data->>'phone_number',
    contact_data->>'mobile',
    contact_data->>'telephone'
  );
  
  company_val := COALESCE(
    contact_data->>'company',
    contact_data->>'business',
    contact_data->>'organization'
  );
  
  -- Only create contact if we have at least a name or email
  IF first_name_val IS NOT NULL OR last_name_val IS NOT NULL OR email_val IS NOT NULL THEN
    INSERT INTO contacts (
      lead_id,
      first_name,
      last_name,
      email,
      phone,
      company,
      assigned_to
    ) VALUES (
      NEW.id,
      first_name_val,
      last_name_val,
      email_val,
      phone_val,
      company_val,
      NEW.assigned_to
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create contact from lead
CREATE TRIGGER trigger_create_contact_from_lead
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION create_contact_from_lead();

-- Create function to update contact when lead is updated
CREATE OR REPLACE FUNCTION update_contact_from_lead()
RETURNS TRIGGER AS $$
DECLARE
  contact_data jsonb;
  first_name_val text;
  last_name_val text;
  email_val text;
  phone_val text;
  company_val text;
BEGIN
  -- Extract common fields from form_data
  contact_data := NEW.form_data;
  
  -- Try to extract name fields (handle various field names)
  first_name_val := COALESCE(
    contact_data->>'first_name',
    contact_data->>'firstName',
    contact_data->>'firstname',
    contact_data->>'fname',
    split_part(COALESCE(contact_data->>'name', contact_data->>'full_name', ''), ' ', 1)
  );
  
  last_name_val := COALESCE(
    contact_data->>'last_name',
    contact_data->>'lastName',
    contact_data->>'lastname',
    contact_data->>'lname',
    split_part(COALESCE(contact_data->>'name', contact_data->>'full_name', ''), ' ', 2)
  );
  
  email_val := COALESCE(
    contact_data->>'email',
    contact_data->>'e_mail',
    contact_data->>'email_address'
  );
  
  phone_val := COALESCE(
    contact_data->>'phone',
    contact_data->>'phone_number',
    contact_data->>'mobile',
    contact_data->>'telephone'
  );
  
  company_val := COALESCE(
    contact_data->>'company',
    contact_data->>'business',
    contact_data->>'organization'
  );
  
  -- Update existing contact
  UPDATE contacts SET
    first_name = first_name_val,
    last_name = last_name_val,
    email = email_val,
    phone = phone_val,
    company = company_val,
    assigned_to = NEW.assigned_to,
    updated_at = now()
  WHERE lead_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update contact when lead is updated
CREATE TRIGGER trigger_update_contact_from_lead
  AFTER UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_from_lead();

-- Create view for lead management with contact info
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
  c.tags,
  c.notes as contact_notes,
  c.last_contacted_at,
  c.created_at as contact_created_at,
  c.updated_at as contact_updated_at
FROM leads l
LEFT JOIN lead_forms lf ON l.form_id = lf.id
LEFT JOIN lead_statuses ls ON l.status_id = ls.id
LEFT JOIN profiles p ON l.assigned_to = p.id
LEFT JOIN contacts c ON l.id = c.lead_id;

-- Grant permissions on the view
GRANT SELECT ON lead_management_view TO authenticated;
GRANT SELECT ON lead_management_view TO public;
