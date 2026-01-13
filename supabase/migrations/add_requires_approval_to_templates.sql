-- Add requires_approval column to email_templates
-- Date: November 17, 2025

ALTER TABLE email_templates 
ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;

-- Update existing templates based on their purpose
-- Extra charges typically require approval
UPDATE email_templates 
SET requires_approval = true 
WHERE name ILIKE '%approval%' 
   OR name ILIKE '%extra charge%'
   OR subject ILIKE '%approval%';

-- Informational/notification templates don't require approval
UPDATE email_templates 
SET requires_approval = false 
WHERE name ILIKE '%notification%' 
   OR name ILIKE '%update%'
   OR name ILIKE '%info%';

COMMENT ON COLUMN email_templates.requires_approval IS 'If true, email will require recipient approval with countdown timer. If false, email is informational only.';
