-- =====================================================
-- FIX: Remove Hardcoded Placeholders from Email Templates
-- =====================================================
-- This fixes email templates that have literal placeholder
-- text like {Timothy Farzalo} and {WO-000760} instead of
-- proper tokens like {{recipient_name}} and {{job_number}}
-- =====================================================

-- Update Extra Charges Approval Email Templates
-- Replace hardcoded names with proper tokens

UPDATE email_templates
SET 
  subject = REGEXP_REPLACE(
    subject, 
    '\{[A-Z]{2}-\d{6}\}', 
    '{{job_number}}', 
    'g'
  ),
  body = REGEXP_REPLACE(
    REGEXP_REPLACE(
      body,
      'Hi \{[^}]+\},',
      'Hi {{recipient_name}},',
      'g'
    ),
    '\{[A-Z]{2}-\d{6}\}',
    '{{job_number}}',
    'g'
  ),
  updated_at = NOW()
WHERE 
  subject LIKE '%Extra Charges Approval%'
  OR subject LIKE '%Approval Needed%'
  OR body LIKE '%{WO-%'
  OR body LIKE '%Hi {%';

-- Also update any preview or test templates
UPDATE email_templates
SET
  body = REGEXP_REPLACE(
    body,
    'Job #\{[A-Z]{2}-\d{6}\}',
    'Job #{{job_number}}',
    'g'
  ),
  updated_at = NOW()
WHERE body LIKE '%Job #{WO-%';

-- Verify the changes
SELECT 
  id,
  tone,
  subject,
  LEFT(body, 200) as body_preview,
  updated_at
FROM email_templates
WHERE 
  subject LIKE '%Approval%'
  OR subject LIKE '%Extra Charges%'
ORDER BY updated_at DESC;

-- =====================================================
-- NOTES:
-- =====================================================
-- Available tokens for Extra Charges emails:
-- 
-- RECIPIENT/CONTACT:
-- {{recipient_name}}          - Name of the email recipient
-- {{ap_contact_name}}         - AP contact name
-- {{contact_name}}            - Generic contact name
-- {{property_owner_name}}     - Property owner name
-- 
-- JOB INFORMATION:
-- {{job_number}}              - Work order number (e.g., WO-000760)
-- {{work_order_number}}       - Same as job_number
-- {{property_name}}           - Property name
-- {{property_address}}        - Full property address
-- {{unit_number}}             - Unit number
-- {{job_type}}                - Type of job
-- {{scheduled_date}}          - Scheduled date
-- 
-- EXTRA CHARGES:
-- {{extra_charges_description}} - Description of extra charges
-- {{extra_charges.bill_amount}} - Bill amount ($X,XXX.XX)
-- {{extra_charges.hours}}       - Number of hours
-- {{estimated_cost}}            - Estimated cost
-- 
-- CORRECT USAGE EXAMPLES:
-- ✅ Hi {{recipient_name}},
-- ✅ Job #{{job_number}}
-- ✅ We need approval for extra work on Job #{{job_number}}.
-- 
-- INCORRECT USAGE (don't use these):
-- ❌ Hi {Timothy Farzalo},
-- ❌ Job #{WO-000760}
-- ❌ Hi {Name},
-- =====================================================
