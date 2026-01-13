-- Enhanced Email Template System Updates
-- This script adds support for multiple email types: approval, sprinkler paint, and future drywall repairs
-- Updated to match the actual email_templates schema: id, name, subject, content, created_at, updated_at

-- First, add the new columns to the existing email_templates table
ALTER TABLE email_templates 
ADD COLUMN IF NOT EXISTS template_type VARCHAR(50) DEFAULT 'approval',
ADD COLUMN IF NOT EXISTS trigger_phase VARCHAR(50),
ADD COLUMN IF NOT EXISTS auto_include_photos BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS photo_types TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS trigger_conditions JSONB DEFAULT '{}';

-- Update existing templates to have proper template_type (they are all approval templates)
UPDATE email_templates SET template_type = 'approval';

-- Insert new template types for sprinkler paint notifications
INSERT INTO email_templates (name, subject, content, template_type, trigger_phase, auto_include_photos, photo_types)
VALUES
  ('Sprinkler Paint - Professional', 'Sprinkler Paint Notification for Job #{{job_number}}', 
   'Hello {{property_name}},

This is a notification that sprinkler paint work has been completed for Job #{{job_number}}.

Property: {{property_address}}
Unit: {{unit_number}}

Sprinkler Paint Details:
Work has been completed and photos are attached for your review.

Thank you,
JG Painting Pros Inc.',
   'notification', 'sprinkler_paint', true, ARRAY['before', 'after', 'sprinkler']),
   
  ('Sprinkler Paint - Casual', 'Sprinkler Paint Complete - Job #{{job_number}}', 
   'Hi {{property_name}},

Just wanted to let you know we''ve finished the sprinkler paint work on Job #{{job_number}}.

Property: {{property_address}}
Unit: {{unit_number}}

Check out the attached photos!

Thanks,
JG Painting Pros Inc.',
   'notification', 'sprinkler_paint', true, ARRAY['before', 'after', 'sprinkler']);

-- Insert new template types for drywall repair notifications (commented out for future use)
-- Uncomment when drywall repairs field is added to the work order form
/*
INSERT INTO email_templates (name, subject, content, template_type, auto_include_photos, photo_types)
VALUES
  ('Drywall Repair - Professional', 'Drywall Repair Notification for Job #[Job ID]', 
   'Hello [Property Manager],

This is a notification that drywall repair work has been completed for Job #[Job ID].

[Job Information]

[Drywall Repair Details]

Photos of the completed repair work are attached for your review.

Thank you,
JG Painting Pros Inc.',
   'drywall_repair', true, ARRAY['before', 'after', 'repair']),
   
  ('Drywall Repair - Casual', 'Drywall Repairs Done - Job #[Job ID]', 
   'Hi [Property Manager],

The drywall repairs for Job #[Job ID] are all finished up!

[Job Details]

[Repair Summary]

Photos attached showing the work completed.

Thanks,
JG Painting Pros Inc.',
   'drywall_repair', true, ARRAY['before', 'after', 'repair']);
*/

-- Display results for verification
SELECT 
  id,
  name,
  template_type,
  auto_include_photos,
  photo_types
FROM email_templates 
ORDER BY template_type, name;
