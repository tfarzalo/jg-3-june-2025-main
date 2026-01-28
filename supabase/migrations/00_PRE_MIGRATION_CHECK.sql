-- ============================================
-- PRE-MIGRATION CHECK
-- Run this BEFORE applying the main migration
-- ============================================

-- Check 1: Find rows that would violate the constraint
SELECT 
  'ROWS THAT WILL BE FIXED' as check_type,
  bc.id,
  p.property_name,
  bc.name,
  bc.is_extra_charge as current_is_extra_charge,
  bc.include_in_work_order as current_include_in_work_order,
  'Will set include_in_work_order = false' as action
FROM billing_categories bc
JOIN properties p ON bc.property_id = p.id
WHERE bc.is_extra_charge = true 
  AND bc.include_in_work_order = true;

-- Expected: Shows all rows where both flags are true
-- These will be automatically fixed by setting include_in_work_order = false


-- Check 2: Find Extra Charges categories that will be archived
SELECT 
  'CATEGORIES TO BE ARCHIVED' as check_type,
  bc.id,
  p.property_name,
  bc.name,
  bc.is_extra_charge,
  bc.include_in_work_order,
  bc.sort_order,
  COUNT(bd.id) as line_items_count,
  'Will be archived for reference' as action
FROM billing_categories bc
JOIN properties p ON bc.property_id = p.id
LEFT JOIN billing_details bd ON bc.id = bd.category_id
WHERE bc.name = 'Extra Charges'
  AND bc.archived_at IS NULL
GROUP BY bc.id, p.property_name, bc.name, bc.is_extra_charge, bc.include_in_work_order, bc.sort_order
ORDER BY p.property_name;

-- Expected: Shows all "Extra Charges" categories that will be archived


-- Check 3: Verify columns don't already exist
SELECT 
  'COLUMN CHECK' as check_type,
  column_name,
  data_type,
  is_nullable,
  CASE 
    WHEN column_name IN ('is_extra_charge', 'archived_at') THEN 'Already exists - migration may fail'
    ELSE 'OK'
  END as status
FROM information_schema.columns
WHERE table_name = 'billing_categories'
  AND column_name IN ('is_extra_charge', 'archived_at', 'include_in_work_order');

-- Expected: 
-- If is_extra_charge and archived_at are NOT listed, migration will proceed normally
-- If they ARE listed, you may need to skip the ALTER TABLE ADD COLUMN steps


-- Check 4: Count total categories affected
SELECT 
  'SUMMARY' as check_type,
  COUNT(*) as total_categories,
  COUNT(*) FILTER (WHERE name = 'Extra Charges') as extra_charges_to_archive,
  COUNT(*) FILTER (WHERE is_extra_charge = true AND include_in_work_order = true) as rows_to_fix,
  COUNT(*) FILTER (WHERE is_extra_charge = true OR name = 'Extra Charges') as total_affected
FROM billing_categories
WHERE archived_at IS NULL;


-- Check 5: Verify audit log table doesn't exist
SELECT 
  'AUDIT LOG TABLE CHECK' as check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'billing_audit_log')
    THEN 'Already exists - will skip creation'
    ELSE 'Will be created'
  END as status;


-- ============================================
-- INTERPRETATION GUIDE
-- ============================================

-- ✅ SAFE TO PROCEED if:
-- - Check 1 shows rows (they will be auto-fixed)
-- - Check 2 shows Extra Charges categories (they will be archived)
-- - Check 3 shows columns don't exist OR status is 'OK'
-- - Check 4 summary looks reasonable
-- - Check 5 shows audit log will be created

-- ⚠️ REVIEW CAREFULLY if:
-- - Check 3 shows columns already exist (may need manual intervention)
-- - Check 4 shows 0 in all columns (nothing to migrate - still safe but verify)

-- ❌ DO NOT PROCEED if:
-- - Any query returns errors
-- - Numbers in Check 4 seem unreasonably high
-- - You don't understand what will happen

-- ============================================
-- NEXT STEPS AFTER RUNNING THIS
-- ============================================

-- If all looks good:
-- 1. Review the affected rows carefully
-- 2. Backup database (if not already done)
-- 3. Run main migration: 20250127000000_add_extra_charge_flag.sql
-- 4. Run verification queries
