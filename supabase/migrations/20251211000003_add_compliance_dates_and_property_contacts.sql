/*
  # Add compliance dates and property contacts with positions

  1) Compliance dates
    - Add date columns for each compliance item on properties
  2) Property contacts
    - Create property_contacts table to store contact details with job position per property
*/

-- Compliance date fields (nullable for backward compatibility)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS compliance_required_date date;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS compliance_approved_date date;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS compliance_bid_approved_date date;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS compliance_po_needed_date date;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS compliance_w9_created_date date;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS compliance_coi_address_date date;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS compliance_create_sub_prop_portal_date date;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS compliance_notify_team_date date;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS compliance_upload_documents_date date;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS compliance_invoice_delivery_date date;

-- Property contacts table to support multiple contacts with roles/positions
CREATE TABLE IF NOT EXISTS property_contacts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  position text,
  name text,
  email text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_contacts_property_id ON property_contacts(property_id);
