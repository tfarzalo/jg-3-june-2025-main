-- Check the actual content of Extra Charges email templates
SELECT 
  id,
  name,
  subject,
  body,
  template_type,
  trigger_phase
FROM email_templates
WHERE template_type = 'extra_charges'
   OR name ILIKE '%extra%charge%'
   OR trigger_phase = 'extra charges approval'
ORDER BY created_at DESC;

-- Also check if there are any templates with brackets in the body
SELECT 
  id,
  name,
  LEFT(body, 200) as body_preview,
  template_type
FROM email_templates
WHERE body LIKE '%{%}%'
ORDER BY updated_at DESC
LIMIT 10;
