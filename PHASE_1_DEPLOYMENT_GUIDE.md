# Phase 1 Implementation - Extra Charges System
## Deployment Guide & Manual Steps

### Overview
This document provides step-by-step instructions for deploying Phase 1 of the Extra Charges system restructure. Phase 1 adds an "Extra Charge" checkbox to property billing categories and archives the old "Extra Charges" category for reference.

---

## Pre-Deployment Checklist

### 1. Backup Database
```bash
# Create a backup before running migrations
# Replace with your actual database credentials
pg_dump -h <host> -U <user> -d <database> > backup_phase1_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Review Changes
- ✅ New database columns: `is_extra_charge`, `archived_at`
- ✅ New audit log table: `billing_audit_log`
- ✅ Database constraint: `check_extra_charge_exclusivity`
- ✅ Helper function: `get_billing_category_display_name()`
- ✅ Frontend utility: `src/utils/billingCategoryHelpers.ts`
- ✅ Component updates: `src/components/BillingDetailsForm.tsx`

---

## Deployment Steps

### Step 1: Apply Database Migration

#### Option A: Using Supabase CLI (Recommended)
```bash
# Navigate to project directory
cd /Users/timothyfarzalo/Desktop/jg-january-2026

# Apply migration
supabase db push

# Or apply specific migration
supabase migration up 20250127000000_add_extra_charge_flag
```

#### Option B: Using Supabase Dashboard
1. Navigate to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/migrations/20250127000000_add_extra_charge_flag.sql`
3. Paste and execute
4. Verify no errors in output

#### Option C: Direct psql
```bash
psql -h <host> -U <user> -d <database> -f supabase/migrations/20250127000000_add_extra_charge_flag.sql
```

### Step 2: Verify Migration Success

Run these queries to confirm migration applied correctly:

```sql
-- Check new columns exist
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'billing_categories'
  AND column_name IN ('is_extra_charge', 'archived_at');

-- Expected output:
--  column_name     | data_type                   | is_nullable
-- ----------------+-----------------------------+-------------
--  is_extra_charge | boolean                     | YES
--  archived_at     | timestamp with time zone    | YES

-- Check archived Extra Charges categories
SELECT 
  id, 
  property_id, 
  name, 
  is_extra_charge, 
  archived_at,
  sort_order
FROM billing_categories
WHERE name = 'Extra Charges'
ORDER BY archived_at NULLS LAST;

-- Verify audit log table exists
SELECT COUNT(*) as archived_count
FROM billing_audit_log
WHERE action = 'ARCHIVED';

-- Test helper function
SELECT get_billing_category_display_name('Repair', true, NULL);
-- Expected: "Extra Charges - Repair"

SELECT get_billing_category_display_name('Extra Charges', true, NOW());
-- Expected: "Extra Charges (Archived)"
```

### Step 3: Deploy Frontend Changes

#### Build and Deploy
```bash
# Install dependencies (if new packages added)
npm install

# Build application
npm run build

# Deploy to production
# (Use your deployment method: Vercel, Netlify, etc.)
npm run deploy
```

#### Verify TypeScript Compilation
```bash
# Check for type errors
npm run type-check

# Or
npx tsc --noEmit
```

### Step 4: Clear Application Cache

```bash
# Clear any cached data
# Browser cache
- Ctrl+Shift+Delete (Chrome/Edge)
- Cmd+Shift+Delete (Mac)

# Service worker cache (if applicable)
- DevTools → Application → Clear Storage → Clear site data
```

---

## Post-Deployment Verification

### Test Checklist

#### 1. View Property Billing Settings
```
Navigate to: Dashboard → Properties → [Select Property] → Billing Details

✅ Verify:
- "Extra Charge" checkbox visible next to "Show on Work Order"
- Info banner explains checkbox logic
- Existing categories display correctly
- No console errors
```

#### 2. Test Extra Charge Checkbox
```
✅ Test Cases:
1. Check "Extra Charge" on a non-default category
   - Category name changes to "Extra Charges - [Name]"
   - "Show on Work Order" automatically unchecks and disables
   - Badge shows "Extra Charge"

2. Uncheck "Extra Charge"
   - Category name reverts to original
   - "Show on Work Order" becomes enabled again
   - Badge removed

3. Try checking "Show on Work Order" when "Extra Charge" is active
   - Should show error toast
   - "Show on Work Order" remains unchecked
```

#### 3. Test Default Categories
```
✅ Verify:
- Labor, Materials show "System Default" badge
- "Extra Charge" checkbox does not appear for defaults
- "Included" indicator shows for defaults
- Cannot delete default categories
```

#### 4. Test Archived Section
```
✅ Verify:
- If "Extra Charges" category existed:
  - Archived section appears at bottom
  - Shows "Reference Only" header
  - Line items displayed (if any existed)
  - Section is faded and disabled
  - Archive date displayed
```

#### 5. Test Save Functionality
```
✅ Test Cases:
1. Toggle "Extra Charge" and save
   - Changes persist after page reload
   - No errors in console
   - Toast shows success message

2. Try to enable both checkboxes and save
   - Should prevent save
   - Error message displayed
   - Data not corrupted
```

#### 6. Test Category Creation
```
✅ Test:
1. Click "Add Category"
2. Select a non-default category
3. Save
4. New category appears in list
5. Can toggle "Extra Charge" checkbox
6. Changes save correctly
```

---

## Manual SQL Commands Reference

### Query Active Extra Charge Categories
```sql
SELECT 
  bc.id,
  bc.name,
  get_billing_category_display_name(bc.name, bc.is_extra_charge, bc.archived_at) as display_name,
  bc.is_extra_charge,
  bc.include_in_work_order,
  bc.sort_order,
  COUNT(bd.id) as line_item_count
FROM billing_categories bc
LEFT JOIN billing_details bd ON bc.id = bd.category_id
WHERE bc.property_id = '<property_id>'
  AND bc.archived_at IS NULL
GROUP BY bc.id
ORDER BY bc.sort_order;
```

### Find Properties with Archived Extra Charges
```sql
SELECT 
  p.id as property_id,
  p.property_name,
  bc.id as category_id,
  bc.archived_at,
  COUNT(bd.id) as preserved_line_items
FROM properties p
JOIN billing_categories bc ON p.id = bc.property_id
LEFT JOIN billing_details bd ON bc.id = bd.category_id
WHERE bc.name = 'Extra Charges'
  AND bc.archived_at IS NOT NULL
GROUP BY p.id, p.property_name, bc.id, bc.archived_at
ORDER BY p.property_name;
```

### View Audit Log
```sql
SELECT 
  bal.created_at,
  p.property_name,
  bc.name as category_name,
  bal.action,
  bal.changes
FROM billing_audit_log bal
JOIN properties p ON bal.property_id = p.id
LEFT JOIN billing_categories bc ON bal.category_id = bc.id
WHERE bal.action = 'ARCHIVED'
ORDER BY bal.created_at DESC
LIMIT 20;
```

### Manually Archive a Category (Emergency Use)
```sql
-- Only if needed to manually archive a category
UPDATE billing_categories
SET 
  archived_at = NOW(),
  is_extra_charge = true,
  sort_order = 9999
WHERE id = '<category_id>'
  AND archived_at IS NULL;

-- Log the action
INSERT INTO billing_audit_log (
  property_id,
  category_id,
  action,
  changes,
  performed_by
)
SELECT 
  property_id,
  id,
  'ARCHIVED',
  jsonb_build_object(
    'reason', 'Manual archive',
    'archived_at', NOW()
  ),
  NULL
FROM billing_categories
WHERE id = '<category_id>';
```

---

## Rollback Procedure

### If Issues Arise

#### 1. Restore Archived Extra Charges Categories
```sql
-- Unarchive Extra Charges categories
UPDATE billing_categories
SET 
  archived_at = NULL,
  sort_order = 4  -- Original position
WHERE name = 'Extra Charges'
  AND archived_at IS NOT NULL;

-- Log rollback
INSERT INTO billing_audit_log (
  property_id,
  category_id,
  action,
  changes
)
SELECT 
  property_id,
  id,
  'UPDATED',
  jsonb_build_object(
    'reason', 'Rollback Phase 1',
    'archived_at', NULL
  )
FROM billing_categories
WHERE name = 'Extra Charges';
```

#### 2. Remove New Columns (Optional)
```sql
-- Only if complete rollback needed
ALTER TABLE billing_categories
DROP COLUMN IF EXISTS is_extra_charge,
DROP COLUMN IF EXISTS archived_at;

-- Remove constraint
ALTER TABLE billing_categories
DROP CONSTRAINT IF EXISTS check_extra_charge_exclusivity;

-- Remove audit log table
DROP TABLE IF EXISTS billing_audit_log CASCADE;

-- Remove helper function
DROP FUNCTION IF EXISTS get_billing_category_display_name(TEXT, BOOLEAN, TIMESTAMPTZ);
```

#### 3. Redeploy Previous Frontend Version
```bash
# Checkout previous commit
git checkout <previous_commit_hash>

# Rebuild and deploy
npm run build
npm run deploy
```

---

## Troubleshooting

### Issue: Migration Fails with "Column Already Exists"
**Solution:**
```sql
-- Check if columns already exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'billing_categories';

-- If they exist, manually add constraint instead
ALTER TABLE billing_categories
ADD CONSTRAINT check_extra_charge_exclusivity
CHECK (NOT (is_extra_charge = true AND include_in_work_order = true));
```

### Issue: Archived Section Not Showing
**Solution:**
```sql
-- Verify archived categories exist
SELECT * FROM billing_categories 
WHERE name = 'Extra Charges' AND archived_at IS NOT NULL;

-- If none, migration may not have run
-- Manually archive if needed (see manual archive section above)
```

### Issue: Checkbox State Not Saving
**Solution:**
1. Check browser console for errors
2. Verify network tab shows successful API calls
3. Check database constraint isn't blocking save:
```sql
-- Check if constraint exists
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'check_extra_charge_exclusivity';
```

### Issue: Display Name Not Updating
**Solution:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Hard refresh page (Ctrl+Shift+R)
3. Verify helper function exists:
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'get_billing_category_display_name';
```

---

## Phase 2 Preparation

### Data Points for Work Order Integration

Phase 2 will use these queries to populate work order form:

```sql
-- Categories for separate sections (Show on Work Order)
SELECT * FROM billing_categories
WHERE property_id = '<property_id>'
  AND include_in_work_order = true
  AND is_extra_charge = false
  AND archived_at IS NULL
ORDER BY sort_order;

-- Categories for Extra Charges dropdown
SELECT 
  bc.*,
  get_billing_category_display_name(bc.name, bc.is_extra_charge, bc.archived_at) as display_name
FROM billing_categories bc
WHERE bc.property_id = '<property_id>'
  AND bc.is_extra_charge = true
  AND bc.archived_at IS NULL
ORDER BY bc.sort_order;

-- Line items for each category
SELECT 
  bd.*,
  us.unit_size_label,
  bc.name as category_name
FROM billing_details bd
JOIN billing_categories bc ON bd.category_id = bc.id
JOIN unit_sizes us ON bd.unit_size_id = us.id
WHERE bd.property_id = '<property_id>'
  AND bc.archived_at IS NULL
ORDER BY bc.sort_order, bd.sort_order;
```

---

## Support & Contact

### Getting Help
- Check console logs for detailed error messages
- Review audit log for recent changes
- Verify database constraints aren't blocking operations

### Monitoring
```sql
-- Daily health check
SELECT 
  COUNT(*) FILTER (WHERE archived_at IS NULL) as active_categories,
  COUNT(*) FILTER (WHERE is_extra_charge = true AND archived_at IS NULL) as extra_charge_categories,
  COUNT(*) FILTER (WHERE archived_at IS NOT NULL) as archived_categories
FROM billing_categories;

-- Check for constraint violations
SELECT * FROM billing_categories
WHERE is_extra_charge = true 
  AND include_in_work_order = true;
-- Should return 0 rows
```

---

## Success Metrics

### Phase 1 Completion Criteria
- [x] Database migration applied successfully
- [x] Extra Charge checkbox visible and functional
- [x] Mutual exclusivity enforced
- [x] Archived section displays correctly
- [x] No errors in production logs
- [x] All test cases pass

### Next: Phase 2 - Work Order Form Integration
Once Phase 1 is verified stable, proceed to Phase 2 which will:
1. Update work order form to show separate sections for `include_in_work_order` categories
2. Add unified Extra Charges dropdown for `is_extra_charge` categories
3. Update billing breakdown to group items correctly
4. Remove archived reference section after verification

---

**Last Updated:** January 27, 2026
**Version:** 1.0.0
**Status:** Ready for Deployment
