# Phase 1 Deployment Checklist

## Pre-Deployment

### Database Backup
- [ ] Create full database backup
  ```bash
  pg_dump -h <host> -U <user> -d <database> > backup_phase1_$(date +%Y%m%d_%H%M%S).sql
  ```
- [ ] Verify backup file size is reasonable
- [ ] Test backup can be restored (optional but recommended)

### Code Review
- [ ] Review migration file: `supabase/migrations/20250127000000_add_extra_charge_flag.sql`
- [ ] Review utility functions: `src/utils/billingCategoryHelpers.ts`
- [ ] Review component changes: `src/components/BillingDetailsForm.tsx`
- [ ] Check TypeScript compilation: `npm run type-check`
- [ ] Check for console errors: `npm run build`

### Documentation Review
- [ ] Read `PHASE_1_DEPLOYMENT_GUIDE.md`
- [ ] Read `PHASE_1_IMPLEMENTATION_SUMMARY.md`
- [ ] Note rollback procedures
- [ ] Prepare monitoring queries

---

## Deployment Steps

### 1. Database Migration
- [ ] Apply migration via Supabase CLI or Dashboard
  ```bash
  supabase db push
  ```
- [ ] Verify no errors in migration output
- [ ] Check migration applied:
  ```sql
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'billing_categories' 
    AND column_name IN ('is_extra_charge', 'archived_at');
  ```

### 2. Verify Database Changes
- [ ] Columns `is_extra_charge` and `archived_at` exist
- [ ] Table `billing_audit_log` exists
- [ ] Constraint `check_extra_charge_exclusivity` exists
- [ ] Function `get_billing_category_display_name` exists
- [ ] Check archived categories:
  ```sql
  SELECT COUNT(*) FROM billing_categories 
  WHERE name = 'Extra Charges' AND archived_at IS NOT NULL;
  ```

### 3. Frontend Deployment
- [ ] Install dependencies: `npm install`
- [ ] Build application: `npm run build`
- [ ] Verify build succeeds with no errors
- [ ] Deploy to production environment
- [ ] Verify deployment successful

### 4. Post-Deployment Verification
- [ ] Navigate to property billing settings page
- [ ] Verify Extra Charge checkbox visible
- [ ] Verify info banner displays correctly
- [ ] Check browser console for errors
- [ ] Verify network calls succeed

---

## Functional Testing

### Test 1: View Billing Settings
- [ ] Navigate to: Dashboard → Properties → [Any Property] → Billing Details
- [ ] Page loads without errors
- [ ] All categories display correctly
- [ ] Info banner explains checkbox logic
- [ ] No console errors

### Test 2: Extra Charge Checkbox - Enable
- [ ] Select a non-default category (e.g., "Repair")
- [ ] Check "Extra Charge" checkbox
- [ ] Verify category name changes to "Extra Charges - Repair"
- [ ] Verify "Show on Work Order" automatically unchecks
- [ ] Verify "Show on Work Order" appears disabled/grayed
- [ ] Verify "Extra Charge" badge appears
- [ ] Click "Save All Changes"
- [ ] Verify success toast appears
- [ ] Refresh page
- [ ] Verify changes persisted

### Test 3: Extra Charge Checkbox - Disable
- [ ] Select a category with Extra Charge enabled
- [ ] Uncheck "Extra Charge" checkbox
- [ ] Verify category name reverts to original
- [ ] Verify "Show on Work Order" becomes enabled
- [ ] Verify badge disappears
- [ ] Click "Save All Changes"
- [ ] Verify success toast appears

### Test 4: Mutual Exclusivity
- [ ] Select a category with Extra Charge enabled
- [ ] Try to check "Show on Work Order"
- [ ] Verify error toast appears
- [ ] Verify "Show on Work Order" remains unchecked
- [ ] Verify no console errors

### Test 5: Default Categories
- [ ] Find "Labor" or "Materials" category
- [ ] Verify "Extra Charge" checkbox does NOT appear
- [ ] Verify "Included" indicator shows
- [ ] Verify "System Default" badge shows
- [ ] Verify cannot delete default category

### Test 6: Archived Section (If Applicable)
- [ ] Scroll to bottom of billing settings page
- [ ] If property had "Extra Charges" category:
  - [ ] Archived section visible
  - [ ] Header says "Reference Only"
  - [ ] Warning banner explains purpose
  - [ ] Original line items displayed
  - [ ] Section is faded/disabled
  - [ ] Archive date shown
- [ ] If no "Extra Charges" existed:
  - [ ] No archived section displays (expected)

### Test 7: Create New Category
- [ ] Click "Add Category" button
- [ ] Select a non-default category from dropdown
- [ ] Add category to property
- [ ] Check "Extra Charge" checkbox
- [ ] Add line items
- [ ] Save all changes
- [ ] Verify new category displays as "Extra Charges - [Name]"

### Test 8: Save with Invalid State
- [ ] Manually try to enable both checkboxes (if possible via dev tools)
- [ ] Click save
- [ ] Verify error message appears
- [ ] Verify data not corrupted
- [ ] Verify can fix and save successfully

---

## Database Verification Queries

### Check Schema Changes
```sql
-- Verify columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'billing_categories'
  AND column_name IN ('is_extra_charge', 'archived_at');

-- Verify constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'check_extra_charge_exclusivity';

-- Verify function
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'get_billing_category_display_name';

-- Verify audit log table
SELECT COUNT(*) FROM billing_audit_log;
```

### Check Data Integrity
```sql
-- Should return 0 (no invalid states)
SELECT COUNT(*) FROM billing_categories
WHERE is_extra_charge = true 
  AND include_in_work_order = true;

-- Check archived categories
SELECT 
  p.property_name,
  bc.name,
  bc.archived_at,
  COUNT(bd.id) as line_items
FROM billing_categories bc
JOIN properties p ON bc.property_id = p.id
LEFT JOIN billing_details bd ON bc.id = bd.category_id
WHERE bc.archived_at IS NOT NULL
GROUP BY p.property_name, bc.name, bc.archived_at;

-- Check extra charge categories
SELECT 
  p.property_name,
  bc.name,
  get_billing_category_display_name(bc.name, bc.is_extra_charge, bc.archived_at) as display_name,
  bc.is_extra_charge,
  bc.include_in_work_order
FROM billing_categories bc
JOIN properties p ON bc.property_id = p.id
WHERE bc.is_extra_charge = true
  AND bc.archived_at IS NULL;
```

---

## Monitoring (First 48 Hours)

### Metrics to Track
- [ ] Error logs - any new errors related to billing?
- [ ] Database query performance - any slow queries?
- [ ] User activity - users accessing billing settings?
- [ ] Save operations - any failed saves?

### Daily Health Check
```sql
-- Run once per day for first week
SELECT 
  COUNT(*) FILTER (WHERE archived_at IS NULL) as active_categories,
  COUNT(*) FILTER (WHERE is_extra_charge = true AND archived_at IS NULL) as extra_charge_categories,
  COUNT(*) FILTER (WHERE archived_at IS NOT NULL) as archived_categories,
  COUNT(*) FILTER (WHERE is_extra_charge = true AND include_in_work_order = true) as invalid_states
FROM billing_categories;

-- Invalid states should always be 0
```

### Monitor Audit Log
```sql
-- Check recent changes
SELECT 
  bal.created_at,
  p.property_name,
  bc.name,
  bal.action,
  bal.changes
FROM billing_audit_log bal
JOIN properties p ON bal.property_id = p.id
LEFT JOIN billing_categories bc ON bal.category_id = bc.id
WHERE bal.created_at > NOW() - INTERVAL '24 hours'
ORDER BY bal.created_at DESC;
```

---

## Rollback (If Needed)

### Criteria for Rollback
Rollback if:
- [ ] Critical errors preventing normal operation
- [ ] Data corruption detected
- [ ] Migration cannot be completed
- [ ] Showstopper bugs discovered

### Rollback Steps
1. [ ] Restore database from backup
   ```bash
   psql -h <host> -U <user> -d <database> < backup_phase1_YYYYMMDD_HHMMSS.sql
   ```

2. [ ] Or run rollback SQL (see PHASE_1_DEPLOYMENT_GUIDE.md)

3. [ ] Redeploy previous frontend version
   ```bash
   git checkout <previous_commit>
   npm run build
   npm run deploy
   ```

4. [ ] Verify rollback successful
5. [ ] Document issue for investigation
6. [ ] Plan fix before re-attempting

---

## Post-Deployment Actions

### Documentation
- [ ] Update internal wiki with new checkbox functionality
- [ ] Notify team of changes
- [ ] Schedule brief demo/training session (optional)

### User Communication
- [ ] Email admins about new Extra Charge feature
- [ ] Provide link to help documentation
- [ ] Note that archived section will be removed in Phase 2

### Phase 2 Preparation
- [ ] Monitor Phase 1 for 48 hours minimum
- [ ] Collect any user feedback
- [ ] Address any minor issues
- [ ] Begin Phase 2 planning when stable

---

## Sign-Off

### Deployment Team
- [ ] Database migration applied: _____________________ (Initials/Date)
- [ ] Frontend deployed: _____________________ (Initials/Date)
- [ ] Verification complete: _____________________ (Initials/Date)

### Testing Team
- [ ] Functional testing complete: _____________________ (Initials/Date)
- [ ] No critical issues found: _____________________ (Initials/Date)

### Approval
- [ ] Phase 1 approved for production: _____________________ (Initials/Date)
- [ ] Ready to proceed to Phase 2: _____________________ (Initials/Date)

---

## Notes & Issues

### Deployment Notes
```
Date: _____________________
Deployed By: _____________________
Environment: _____________________
Database Version: _____________________
Frontend Version/Commit: _____________________

Notes:




```

### Issues Encountered
```
Issue #1:
Description:
Resolution:
Status:

Issue #2:
Description:
Resolution:
Status:
```

---

**Checklist Version:** 1.0
**Last Updated:** January 27, 2026
**Next Review:** After Phase 2 Deployment
