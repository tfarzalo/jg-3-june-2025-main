-- =====================================================
-- Migration Verification Script
-- Run this after applying the main migration to verify success
-- =====================================================

-- Check that property_contacts columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'property_contacts'
  AND column_name IN (
    'secondary_email',
    'is_subcontractor_contact',
    'is_accounts_receivable_contact',
    'is_approval_recipient',
    'is_notification_recipient',
    'is_primary_approval_recipient',
    'is_primary_notification_recipient'
  )
ORDER BY ordinal_position;

-- Expected result: 7 rows showing all the role columns

-- Check that properties.contact_role_config exists
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'properties'
  AND column_name = 'contact_role_config';

-- Expected result: 1 row showing jsonb column with default '{}'

-- Check that indexes were created
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'property_contacts'
  AND indexname LIKE 'idx_property_contacts%'
ORDER BY indexname;

-- Expected result: 5 indexes (property_id, approval_recipients, notification_recipients, subcontractor, ar)

-- Check that trigger exists
SELECT 
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'property_contacts'
  AND trigger_name = 'trg_property_contacts_single_roles';

-- Expected result: 1 row showing BEFORE INSERT OR UPDATE trigger

-- Check that trigger function exists
SELECT 
  proname,
  prosrc
FROM pg_proc
WHERE proname = 'enforce_property_contact_single_roles';

-- Expected result: 1 row showing the function

-- Test data integrity (should return 0 for all checks)
-- Check 1: No property should have multiple subcontractor contacts
SELECT 
  property_id,
  COUNT(*) as subcontractor_count
FROM property_contacts
WHERE is_subcontractor_contact = true
GROUP BY property_id
HAVING COUNT(*) > 1;

-- Expected result: 0 rows

-- Check 2: No property should have multiple AR contacts
SELECT 
  property_id,
  COUNT(*) as ar_count
FROM property_contacts
WHERE is_accounts_receivable_contact = true
GROUP BY property_id
HAVING COUNT(*) > 1;

-- Expected result: 0 rows

-- Check 3: No property should have multiple primary approval recipients
SELECT 
  property_id,
  COUNT(*) as primary_approval_count
FROM property_contacts
WHERE is_primary_approval_recipient = true
GROUP BY property_id
HAVING COUNT(*) > 1;

-- Expected result: 0 rows

-- Check 4: No property should have multiple primary notification recipients
SELECT 
  property_id,
  COUNT(*) as primary_notification_count
FROM property_contacts
WHERE is_primary_notification_recipient = true
GROUP BY property_id
HAVING COUNT(*) > 1;

-- Expected result: 0 rows

-- Check 5: All primary approval recipients should also be approval recipients
SELECT 
  id,
  property_id,
  name,
  is_primary_approval_recipient,
  is_approval_recipient
FROM property_contacts
WHERE is_primary_approval_recipient = true
  AND is_approval_recipient = false;

-- Expected result: 0 rows

-- Check 6: All primary notification recipients should also be notification recipients
SELECT 
  id,
  property_id,
  name,
  is_primary_notification_recipient,
  is_notification_recipient
FROM property_contacts
WHERE is_primary_notification_recipient = true
  AND is_notification_recipient = false;

-- Expected result: 0 rows

-- Summary query: Show current contact role assignments
SELECT 
  p.property_name,
  pc.name as contact_name,
  pc.email,
  pc.is_subcontractor_contact,
  pc.is_accounts_receivable_contact,
  pc.is_approval_recipient,
  pc.is_primary_approval_recipient,
  pc.is_notification_recipient,
  pc.is_primary_notification_recipient
FROM property_contacts pc
JOIN properties p ON p.id = pc.property_id
WHERE 
  pc.is_subcontractor_contact = true
  OR pc.is_accounts_receivable_contact = true
  OR pc.is_approval_recipient = true
  OR pc.is_notification_recipient = true
ORDER BY p.property_name, pc.name;

-- This will show all contacts with any role assigned

-- Check properties with contact_role_config set
SELECT 
  id,
  property_name,
  contact_role_config
FROM properties
WHERE contact_role_config IS NOT NULL
  AND contact_role_config::text != '{}'::text
ORDER BY property_name;

-- This will show properties that have system contact roles configured

-- Verification complete
-- All queries above should return expected results
-- If any query fails or returns unexpected data, review the migration

-- Note: To add a comment to the current database about verification,
-- run this separately after verification:
-- SELECT 'Migration 20260210000001 verified successfully at ' || NOW();
