# UPDATED: Phase 1 SQL Execution Guide
## Fix for Constraint Violation Error

---

## Problem Encountered

**Error:** `check constraint "check_extra_charge_exclusivity" of relation "billing_categories" is violated by some row`

**Cause:** Existing data has rows where both `is_extra_charge = true` AND `include_in_work_order = true`

**Solution:** Fix data before applying constraint

---

## REVISED EXECUTION ORDER

### Step 1: Pre-Migration Check (Optional but Recommended)

**File:** `00_PRE_MIGRATION_CHECK.sql`

Run this to see what will be affected:

```bash
# In Supabase Dashboard → SQL Editor
# Copy and paste contents of:
/Users/timothyfarzalo/Desktop/jg-january-2026/supabase/migrations/00_PRE_MIGRATION_CHECK.sql
```

This shows:
- Rows that will be fixed
- Categories that will be archived
- Summary of changes

---

### Step 2: Fix Constraint Violation (REQUIRED)

**File:** `00_FIX_CONSTRAINT_VIOLATION.sql`

Run this to fix the immediate error:

```bash
# In Supabase Dashboard → SQL Editor
# Copy and paste contents of:
/Users/timothyfarzalo/Desktop/jg-january-2026/supabase/migrations/00_FIX_CONSTRAINT_VIOLATION.sql
```

**Expected Output:**
- `rows_fixed`: Shows how many rows were updated
- `remaining_violations`: Should be 0
- Shows list of affected categories

**This fixes:** Sets `include_in_work_order = false` for any category where `is_extra_charge = true`

---

### Step 3: Apply Main Migration (REQUIRED)

**File:** `20250127000000_add_extra_charge_flag.sql` (UPDATED - constraint violation fix included)

Now that data is clean, apply the main migration:

#### Option A: Supabase CLI
```bash
cd /Users/timothyfarzalo/Desktop/jg-january-2026
supabase db push
```

#### Option B: Supabase Dashboard
```bash
# In Supabase Dashboard → SQL Editor
# Copy and paste contents of:
/Users/timothyfarzalo/Desktop/jg-january-2026/supabase/migrations/20250127000000_add_extra_charge_flag.sql
```

**What it does:**
1. Adds `is_extra_charge` column
2. Adds `archived_at` column
3. Creates `billing_audit_log` table
4. Archives existing "Extra Charges" categories
5. **Fixes any remaining data issues**
6. Adds constraint to prevent future violations
7. Creates helper function

---

### Step 4: Verification (REQUIRED)

Run these queries to confirm success:

```sql
-- Quick verification
SELECT 
  'Columns Added' as check,
  COUNT(*) as result
FROM information_schema.columns
WHERE table_name = 'billing_categories'
  AND column_name IN ('is_extra_charge', 'archived_at');
-- Expected: 2

SELECT 
  'Constraint Added' as check,
  COUNT(*) as result
FROM pg_constraint
WHERE conname = 'check_extra_charge_exclusivity';
-- Expected: 1

SELECT 
  'No Violations' as check,
  COUNT(*) as result
FROM billing_categories
WHERE is_extra_charge = true AND include_in_work_order = true;
-- Expected: 0 (MUST BE ZERO)

SELECT 
  'Archived Categories' as check,
  COUNT(*) as result
FROM billing_categories
WHERE name = 'Extra Charges' AND archived_at IS NOT NULL;
-- Expected: >= 0 (shows how many were archived)

SELECT 
  'Audit Log Exists' as check,
  COUNT(*) as result
FROM information_schema.tables
WHERE table_name = 'billing_audit_log';
-- Expected: 1

SELECT 
  'Helper Function Exists' as check,
  COUNT(*) as result
FROM information_schema.routines
WHERE routine_name = 'get_billing_category_display_name';
-- Expected: 1
```

---

## COMPLETE COMMAND SEQUENCE

Copy and paste this into Supabase Dashboard → SQL Editor in order:

### 1. Pre-Check (Optional)
```sql
-- Paste entire contents of 00_PRE_MIGRATION_CHECK.sql
-- Review results
```

### 2. Fix Data (Required)
```sql
-- Paste entire contents of 00_FIX_CONSTRAINT_VIOLATION.sql
-- Verify remaining_violations = 0
```

### 3. Apply Migration (Required)
```sql
-- Paste entire contents of 20250127000000_add_extra_charge_flag.sql
-- Wait for "Success" message
```

### 4. Verify (Required)
```sql
-- Run the 6 verification queries above
-- All should return expected results
```

---

## What Changed in the Migration

The updated migration now includes:

```sql
-- NEW: Data cleanup step BEFORE adding constraint
UPDATE billing_categories
SET include_in_work_order = false
WHERE is_extra_charge = true 
  AND include_in_work_order = true;
```

This ensures no rows violate the constraint when it's added.

---

## If You Still Get Errors

### Error: "Column already exists"

**Solution:** The columns were partially added. Run this first:

```sql
-- Check what exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'billing_categories';

-- If is_extra_charge and archived_at exist, skip to constraint:
ALTER TABLE billing_categories
ADD CONSTRAINT check_extra_charge_exclusivity
CHECK (NOT (is_extra_charge = true AND include_in_work_order = true));
```

### Error: "Constraint already exists"

**Solution:** Constraint was already added. This is OK, skip to verification.

### Error: "Table billing_audit_log already exists"

**Solution:** Table was already created. This is OK, skip to verification.

---

## Rollback (If Needed)

If you need to undo everything:

```sql
BEGIN;

-- Remove constraint
ALTER TABLE billing_categories
DROP CONSTRAINT IF EXISTS check_extra_charge_exclusivity;

-- Unarchive categories
UPDATE billing_categories
SET archived_at = NULL, sort_order = 4
WHERE name = 'Extra Charges' AND archived_at IS NOT NULL;

-- Reset flags
UPDATE billing_categories
SET is_extra_charge = false;

-- Optional: Remove columns
ALTER TABLE billing_categories
DROP COLUMN IF EXISTS is_extra_charge,
DROP COLUMN IF EXISTS archived_at;

-- Optional: Remove audit log
DROP TABLE IF EXISTS billing_audit_log CASCADE;

-- Optional: Remove function
DROP FUNCTION IF EXISTS get_billing_category_display_name(TEXT, BOOLEAN, TIMESTAMPTZ);

COMMIT;
```

---

## Summary

**Files to Run in Order:**

1. ✅ `00_FIX_CONSTRAINT_VIOLATION.sql` - Fix immediate error
2. ✅ `20250127000000_add_extra_charge_flag.sql` - Main migration (updated)
3. ✅ Verification queries - Confirm success

**Total Time:** 5-10 minutes

**Status:** Migration updated to handle existing data conflicts

**Next:** Deploy frontend changes after SQL migration succeeds
