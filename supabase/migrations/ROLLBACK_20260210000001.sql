-- =====================================================
-- ROLLBACK SCRIPT for Property Contact Roles Migration
-- =====================================================
-- Use this script ONLY if you need to reverse the migration
-- WARNING: This will remove all contact role assignments
-- =====================================================

-- Step 1: Remove the trigger
DROP TRIGGER IF EXISTS trg_property_contacts_single_roles ON public.property_contacts;

-- Step 2: Remove the trigger function
DROP FUNCTION IF EXISTS public.enforce_property_contact_single_roles();

-- Step 3: Remove indexes
DROP INDEX IF EXISTS public.idx_property_contacts_property_id;
DROP INDEX IF EXISTS public.idx_property_contacts_approval_recipients;
DROP INDEX IF EXISTS public.idx_property_contacts_notification_recipients;
DROP INDEX IF EXISTS public.idx_property_contacts_subcontractor;
DROP INDEX IF EXISTS public.idx_property_contacts_ar;

-- Step 4: Remove columns from property_contacts
ALTER TABLE public.property_contacts 
DROP COLUMN IF EXISTS is_subcontractor_contact,
DROP COLUMN IF EXISTS is_accounts_receivable_contact,
DROP COLUMN IF EXISTS is_approval_recipient,
DROP COLUMN IF EXISTS is_notification_recipient,
DROP COLUMN IF EXISTS is_primary_approval_recipient,
DROP COLUMN IF EXISTS is_primary_notification_recipient;

-- Note: We keep secondary_email as it may have been added independently
-- If you want to remove it too, uncomment the next line:
-- ALTER TABLE public.property_contacts DROP COLUMN IF EXISTS secondary_email;

-- Step 5: Remove contact_role_config from properties
ALTER TABLE public.properties 
DROP COLUMN IF EXISTS contact_role_config;

-- Step 6: Verify rollback (should return empty results)
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'property_contacts' 
  AND column_name LIKE 'is_%';

SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'properties' 
  AND column_name = 'contact_role_config';

-- If above queries return no rows, rollback was successful

COMMENT ON DATABASE CURRENT_DATABASE() IS 'Migration 20260210000001 rolled back';
