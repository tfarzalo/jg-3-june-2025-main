-- Drop and recreate email_templates table
DROP TABLE IF EXISTS email_templates CASCADE;

CREATE TABLE email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drop and recreate email_signatures table
DROP TABLE IF EXISTS email_signatures CASCADE;

CREATE TABLE email_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to email_templates table
CREATE TRIGGER set_updated_at_email_templates
BEFORE UPDATE ON email_templates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to email_signatures table
CREATE TRIGGER set_updated_at_email_signatures
BEFORE UPDATE ON email_signatures
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Insert default email templates
INSERT INTO email_templates (name, subject, content)
VALUES
  ('Formal', 'Approval Request for Job #[Job ID]', 'Dear [Property Manager],\n\nI am writing to request your approval for additional charges related to Job #[Job ID].\n\n[Job Details]\n\n[Work Order Details]\n\nPlease review these charges and let us know if you approve.\n\nThank you,\nJG Painting Pros Inc.'),
  ('Professional', 'Approval Needed for Job #[Job ID]', 'Hello [Property Manager],\n\nWe need your approval for some additional charges for Job #[Job ID].\n\n[Job Information]\n\n[Additional Charges]\n\nPlease review and approve these charges at your earliest convenience.\n\nThank you,\nJG Painting Pros Inc.'),
  ('Casual', 'Quick Approval Needed for Job #[Job ID]', 'Hi [Property Manager],\n\nQuick note about some extra charges for Job #[Job ID] that need your approval.\n\n[Quick Job Info]\n\n[Extra Charges]\n\nLet me know if you''re good with these charges!\n\nThank you,\nJG Painting Pros Inc.');

-- Insert default email signature
INSERT INTO email_signatures (content)
VALUES ('Best regards,\nJG Painting Pros Inc.');
