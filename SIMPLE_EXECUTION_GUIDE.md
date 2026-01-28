# SIMPLE EXECUTION GUIDE - Phase 1

## Problem: Column Order Issue Fixed ✅

The migration has been **FIXED**. The columns are now added BEFORE any updates that use them.

---

## What To Do Now: Just Run the Main Migration

You can **SKIP** the fix script (`00_FIX_CONSTRAINT_VIOLATION.sql`) and go straight to the main migration.

---

## Single Command Execution

### Option A: Supabase CLI (Easiest)

```bash
cd /Users/timothyfarzalo/Desktop/jg-january-2026
supabase db push
```

### Option B: Supabase Dashboard

1. Open Supabase Dashboard
2. Go to **SQL Editor**
3. Copy **entire contents** of this file:
   ```
   /Users/timothyfarzalo/Desktop/jg-january-2026/supabase/migrations/20250127000000_add_extra_charge_flag.sql
   ```
4. Paste into SQL Editor
5. Click **RUN**
6. Wait for "Success" message

---

## What The Migration Does (In Order)

1. ✅ **Adds columns** (`is_extra_charge`, `archived_at`)
2. ✅ **Creates indexes** for performance
3. ✅ **Archives** existing "Extra Charges" categories
4. ✅ **Creates audit log** table
5. ✅ **Logs changes** to audit table
6. ✅ **Cleans up data** (fixes any violations)
7. ✅ **Adds constraint** (prevents future violations)
8. ✅ **Creates helper function** for display names

Everything is in the correct order now!

---

## Verify Success (After Running)

Run this query in SQL Editor:

```sql
-- Quick health check
SELECT 
  'Columns Exist' as check,
  COUNT(*) as result,
  CASE WHEN COUNT(*) = 2 THEN '✅ PASS' ELSE '❌ FAIL' END as status
FROM information_schema.columns
WHERE table_name = 'billing_categories'
  AND column_name IN ('is_extra_charge', 'archived_at')

UNION ALL

SELECT 
  'No Violations',
  COUNT(*),
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM billing_categories
WHERE is_extra_charge = true AND include_in_work_order = true

UNION ALL

SELECT 
  'Constraint Added',
  COUNT(*),
  CASE WHEN COUNT(*) = 1 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM pg_constraint
WHERE conname = 'check_extra_charge_exclusivity'

UNION ALL

SELECT 
  'Audit Log Created',
  COUNT(*),
  CASE WHEN COUNT(*) = 1 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM information_schema.tables
WHERE table_name = 'billing_audit_log'

UNION ALL

SELECT 
  'Helper Function Created',
  COUNT(*),
  CASE WHEN COUNT(*) = 1 THEN '✅ PASS' ELSE '❌ FAIL' END
FROM information_schema.routines
WHERE routine_name = 'get_billing_category_display_name';
```

**Expected:** All 5 checks show "✅ PASS"

---

## If You Still Get Errors

### Error: "column already exists"
**Solution:** Columns were partially added. The `IF NOT EXISTS` should handle this, but if not:

```sql
-- Just add the constraint and helper function manually
ALTER TABLE billing_categories
ADD CONSTRAINT check_extra_charge_exclusivity
CHECK (NOT (is_extra_charge = true AND include_in_work_order = true));
```

### Error: "constraint already exists"
**Solution:** Already done! Skip to verification queries.

### Any other error
**Solution:** Share the error message and I'll help fix it.

---

## Summary

**What changed:** Migration now adds columns FIRST, then uses them.

**What to run:** Just the main migration file: `20250127000000_add_extra_charge_flag.sql`

**How long:** 30 seconds to 2 minutes

**Risk:** Low - fully reversible

**Next step:** Deploy frontend after SQL succeeds

---

## Quick Reference

```bash
# Single command to execute everything:
cd /Users/timothyfarzalo/Desktop/jg-january-2026
supabase db push

# Then verify with the health check query above
```

That's it! 🚀
