# Manual Commands for Phase 1 Deployment

## Quick Reference Guide

This document contains all manual commands you need to run for Phase 1 deployment, in order.

---

## 1. Pre-Deployment: Backup Database

### Create Backup
```bash
# Using Supabase (recommended if using Supabase)
# Backups are automatic, but you can create manual backup via Dashboard

# Using direct PostgreSQL
pg_dump -h your-db-host.supabase.co \
        -U postgres \
        -d postgres \
        --no-owner \
        --no-acl \
        > backup_phase1_$(date +%Y%m%d_%H%M%S).sql
```

### Verify Backup
```bash
# Check file size
ls -lh backup_phase1_*.sql

# Expected: Several MB depending on database size
```

---

## 2. Deployment: Apply Migration

### Method A: Supabase CLI (Recommended)
```bash
# Navigate to project directory
cd /Users/timothyfarzalo/Desktop/jg-january-2026

# Apply all pending migrations
supabase db push

# Or apply specific migration
supabase migration up 20250127000000_add_extra_charge_flag
```

### Method B: Supabase Dashboard
1. Open Supabase Dashboard
2. Go to SQL Editor
3. Copy entire contents of:
   `/Users/timothyfarzalo/Desktop/jg-january-2026/supabase/migrations/20250127000000_add_extra_charge_flag.sql`
4. Paste into editor
5. Click "Run"
6. Verify "Success" message

### Method C: Direct psql
```bash
psql -h your-db-host.supabase.co \
     -U postgres \
     -d postgres \
     -f /Users/timothyfarzalo/Desktop/jg-january-2026/supabase/migrations/20250127000000_add_extra_charge_flag.sql
```

---

## 3. Verification: Check Migration Success

### Run these SQL commands in Supabase Dashboard → SQL Editor:

```sql
-- ============================================
-- VERIFICATION QUERIES - RUN ALL
-- ============================================

-- 1. Check new columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'billing_categories'
  AND column_name IN ('is_extra_charge', 'archived_at');

-- Expected output: 2 rows showing both columns

-- 2. Check audit log table exists
SELECT COUNT(*) as audit_log_exists
FROM information_schema.tables
WHERE table_name = 'billing_audit_log';

-- Expected output: 1

-- 3. Check constraint exists
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname = 'check_extra_charge_exclusivity';

-- Expected output: 1 row showing constraint

-- 4. Check helper function exists
SELECT routine_name
FROM information_schema.routines
WHERE routine_name = 'get_billing_category_display_name';

-- Expected output: 1 row

-- 5. Check archived Extra Charges categories
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

-- Expected output: Shows all former Extra Charges categories with archived_at timestamp

-- 6. Test helper function
SELECT get_billing_category_display_name('Repair', true, NULL) as test_extra_charge;
-- Expected output: "Extra Charges - Repair"

SELECT get_billing_category_display_name('Extra Charges', true, NOW()) as test_archived;
-- Expected output: "Extra Charges (Archived)"

-- 7. Check for invalid states (should be 0)
SELECT COUNT(*) as invalid_states
FROM billing_categories
WHERE is_extra_charge = true 
  AND include_in_work_order = true;

-- Expected output: 0

-- 8. View audit log entries
SELECT 
  created_at,
  action,
  changes
FROM billing_audit_log
WHERE action = 'ARCHIVED'
ORDER BY created_at DESC
LIMIT 10;

-- Expected output: Shows archived Extra Charges entries
```

### ✅ All Good If:
- All 8 queries return expected results
- No errors in output
- Archived Extra Charges categories shown (if they existed before)

---

## 4. Frontend Deployment

### Build Frontend
```bash
# Navigate to project directory
cd /Users/timothyfarzalo/Desktop/jg-january-2026

# Install dependencies (if new)
npm install

# Type check
npm run type-check

# Build application
npm run build
```

### Deploy (Method depends on your hosting)

#### Option A: Vercel
```bash
vercel deploy --prod
```

#### Option B: Netlify
```bash
netlify deploy --prod
```

#### Option C: Manual
```bash
# Copy build folder to your server
# Restart your application
pm2 restart your-app
```

---

## 5. Post-Deployment Verification

### Browser Testing
1. Open application in browser
2. Navigate to: Dashboard → Properties → [Select Any Property] → Billing Details
3. Open Browser DevTools (F12)
4. Check Console tab - should be no errors
5. Verify UI displays correctly

### Database Health Check
```sql
-- Run this query to get overview
SELECT 
  COUNT(*) FILTER (WHERE archived_at IS NULL) as active_categories,
  COUNT(*) FILTER (WHERE is_extra_charge = true AND archived_at IS NULL) as extra_charge_categories,
  COUNT(*) FILTER (WHERE archived_at IS NOT NULL) as archived_categories,
  COUNT(*) FILTER (WHERE is_extra_charge = true AND include_in_work_order = true) as invalid_states
FROM billing_categories;

-- Invalid states should ALWAYS be 0
```

---

## 6. Monitoring Commands

### Daily Health Check (Run Once Per Day for First Week)
```sql
-- Copy this entire query and run daily
WITH category_stats AS (
  SELECT 
    p.property_name,
    COUNT(*) as total_categories,
    COUNT(*) FILTER (WHERE bc.is_extra_charge = true) as extra_charges,
    COUNT(*) FILTER (WHERE bc.archived_at IS NOT NULL) as archived
  FROM billing_categories bc
  JOIN properties p ON bc.property_id = p.id
  GROUP BY p.property_name
)
SELECT 
  property_name,
  total_categories,
  extra_charges,
  archived
FROM category_stats
ORDER BY property_name;

-- Check audit log activity
SELECT 
  DATE(created_at) as date,
  action,
  COUNT(*) as count
FROM billing_audit_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), action
ORDER BY date DESC, action;
```

### Check for Errors
```sql
-- Look for any constraint violations
SELECT 
  p.property_name,
  bc.name,
  bc.is_extra_charge,
  bc.include_in_work_order,
  'INVALID: Both flags enabled' as issue
FROM billing_categories bc
JOIN properties p ON bc.property_id = p.id
WHERE bc.is_extra_charge = true 
  AND bc.include_in_work_order = true;

-- Should return 0 rows
```

---

## 7. Troubleshooting Commands

### If Migration Fails

```sql
-- Check what columns currently exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'billing_categories'
ORDER BY ordinal_position;

-- If columns already exist, just add constraint
ALTER TABLE billing_categories
ADD CONSTRAINT check_extra_charge_exclusivity
CHECK (NOT (is_extra_charge = true AND include_in_work_order = true));
```

### If Archived Section Not Showing

```sql
-- Check if Extra Charges categories exist
SELECT 
  p.property_name,
  bc.name,
  bc.archived_at
FROM billing_categories bc
JOIN properties p ON bc.property_id = p.id
WHERE bc.name = 'Extra Charges';

-- If no results, migration may not have archived anything (this is OK if none existed)
```

### If Categories Not Saving

```sql
-- Check recent audit log entries
SELECT 
  created_at,
  action,
  changes,
  performed_by
FROM billing_audit_log
ORDER BY created_at DESC
LIMIT 20;

-- Look for error patterns
```

---

## 8. Rollback Commands (If Needed)

### Quick Rollback (Restore Backup)
```bash
# Stop application first
pm2 stop your-app

# Restore database
psql -h your-db-host.supabase.co \
     -U postgres \
     -d postgres \
     < backup_phase1_YYYYMMDD_HHMMSS.sql

# Restart application
pm2 start your-app
```

### Surgical Rollback (Keep Data, Remove Features)
```sql
-- Unarchive Extra Charges categories
UPDATE billing_categories
SET 
  archived_at = NULL,
  sort_order = 4
WHERE name = 'Extra Charges'
  AND archived_at IS NOT NULL;

-- Reset extra charge flags
UPDATE billing_categories
SET is_extra_charge = false
WHERE name != 'Extra Charges'
  AND is_extra_charge = true;

-- Optional: Remove columns
ALTER TABLE billing_categories
DROP COLUMN IF EXISTS is_extra_charge,
DROP COLUMN IF EXISTS archived_at;

-- Remove constraint
ALTER TABLE billing_categories
DROP CONSTRAINT IF EXISTS check_extra_charge_exclusivity;

-- Remove audit log table (optional)
DROP TABLE IF EXISTS billing_audit_log CASCADE;

-- Remove helper function (optional)
DROP FUNCTION IF EXISTS get_billing_category_display_name(TEXT, BOOLEAN, TIMESTAMPTZ);
```

---

## 9. Phase 2 Preparation Queries

### Get Extra Charge Categories for Work Order Integration
```sql
-- Categories that should appear as separate sections
SELECT 
  bc.id,
  bc.name,
  bc.sort_order,
  COUNT(bd.id) as line_item_count
FROM billing_categories bc
LEFT JOIN billing_details bd ON bc.id = bd.category_id
WHERE bc.property_id = 'YOUR_PROPERTY_ID'
  AND bc.include_in_work_order = true
  AND bc.is_extra_charge = false
  AND bc.archived_at IS NULL
GROUP BY bc.id, bc.name, bc.sort_order
ORDER BY bc.sort_order;

-- Categories that should appear in Extra Charges dropdown
SELECT 
  bc.id,
  bc.name,
  get_billing_category_display_name(bc.name, bc.is_extra_charge, bc.archived_at) as display_name,
  bc.sort_order,
  COUNT(bd.id) as line_item_count
FROM billing_categories bc
LEFT JOIN billing_details bd ON bc.id = bd.category_id
WHERE bc.property_id = 'YOUR_PROPERTY_ID'
  AND bc.is_extra_charge = true
  AND bc.archived_at IS NULL
GROUP BY bc.id, bc.name, bc.is_extra_charge, bc.archived_at, bc.sort_order
ORDER BY bc.sort_order;
```

---

## Command Execution Order Summary

1. ✅ **Backup Database** (`pg_dump`)
2. ✅ **Apply Migration** (`supabase db push` or SQL Editor)
3. ✅ **Verify Migration** (Run 8 verification queries)
4. ✅ **Build Frontend** (`npm run build`)
5. ✅ **Deploy Frontend** (`vercel deploy` or your method)
6. ✅ **Test in Browser** (Manual UI testing)
7. ✅ **Run Health Check** (Daily monitoring query)
8. ⏸️ **Monitor for 48 Hours**
9. ✅ **Proceed to Phase 2** (If all stable)

---

## Need Help?

### Quick Diagnostics
```sql
-- Run this "health check all" query anytime:
SELECT 
  'Columns Exist' as check_type,
  COUNT(*) as result,
  'Expected: 2' as expected
FROM information_schema.columns
WHERE table_name = 'billing_categories'
  AND column_name IN ('is_extra_charge', 'archived_at')

UNION ALL

SELECT 
  'Audit Log Exists',
  COUNT(*),
  'Expected: 1'
FROM information_schema.tables
WHERE table_name = 'billing_audit_log'

UNION ALL

SELECT 
  'Invalid States',
  COUNT(*),
  'Expected: 0'
FROM billing_categories
WHERE is_extra_charge = true AND include_in_work_order = true

UNION ALL

SELECT 
  'Extra Charge Categories',
  COUNT(*),
  'Expected: >= 0'
FROM billing_categories
WHERE is_extra_charge = true AND archived_at IS NULL

UNION ALL

SELECT 
  'Archived Categories',
  COUNT(*),
  'Expected: >= 0'
FROM billing_categories
WHERE archived_at IS NOT NULL;
```

---

**Last Updated:** January 27, 2026
**Quick Start:** Run commands in order 1-7
**Total Time:** ~15-30 minutes
**Risk Level:** Low (fully reversible)
