# 🔧 DECLINE FUNCTION FIX - changed_by Constraint Issue

**Date:** December 11, 2025  
**Issue:** Decline function fails with constraint violation  
**Error:** `null value in column "changed_by" of relation "job_phase_changes" violates not-null constraint`

---

## 🎯 Root Cause

The `process_decline_token` function was trying to insert a record into `job_phase_changes` table, but:
1. The `changed_by` column has a NOT NULL constraint
2. External users (anonymous) don't have a user ID
3. Result: Database constraint violation

---

## ✅ Solution

**Remove the `job_phase_changes` insert** from the decline function because:
1. ✅ Decline doesn't actually change the job phase (stays at current phase)
2. ✅ The decline is already fully recorded in `approval_tokens` table
3. ✅ No user ID available for external/anonymous declines
4. ✅ Admins can see decline in job details from `approval_tokens.decision`

---

## ⚡ Apply the Fix

Run this file in Supabase SQL Editor:
```
FIX_DECLINE_FUNCTION_CHANGED_BY_CONSTRAINT.sql
```

This will:
1. Drop the old function
2. Create new version without `job_phase_changes` insert
3. Keep all decline tracking in `approval_tokens` table
4. Verify creation was successful

---

## 📊 What Gets Recorded

### ✅ In `approval_tokens` table:
- `used_at` - Timestamp when declined
- `decision` - 'declined'
- `decision_at` - Timestamp of decision
- `decline_reason` - Optional reason text

### ❌ NOT in `job_phase_changes`:
- No entry created (phase doesn't change)
- Avoids NULL constraint violation
- Decline still fully tracked in `approval_tokens`

---

## 🧪 Testing After Fix

1. **Apply the fix:** Run `FIX_DECLINE_FUNCTION_CHANGED_BY_CONSTRAINT.sql`
2. **Test decline link:** Click decline button in approval email
3. **Expected result:** Success page (no error)
4. **Verify in database:**
   ```sql
   SELECT token, decision, decision_at, decline_reason, used_at
   FROM approval_tokens
   WHERE decision = 'declined'
   ORDER BY decision_at DESC
   LIMIT 1;
   ```

---

## 📝 Technical Details

### Before (Failing):
```sql
INSERT INTO job_phase_changes (
  job_id,
  changed_by,  -- ❌ NULL value violates NOT NULL constraint
  from_phase_id,
  to_phase_id,
  change_reason
) VALUES (...);
```

### After (Fixed):
```sql
-- Simply don't insert into job_phase_changes
-- All decline data is in approval_tokens table
UPDATE approval_tokens
SET used_at = NOW(),
    decision = 'declined',
    decision_at = NOW(),
    decline_reason = p_decline_reason
WHERE token = p_token;
```

---

## 🔍 Alternative Solutions Considered

### ❌ Option 1: Make `changed_by` nullable
- Would require schema migration
- Could break other parts of system expecting user ID
- Not recommended for tracking job phase changes

### ❌ Option 2: Create a system user for external actions
- More complex
- Still creates unnecessary phase change record
- Phase isn't actually changing

### ✅ Option 3: Don't insert into `job_phase_changes` (CHOSEN)
- Simplest solution
- Phase isn't changing anyway
- Decline fully tracked in `approval_tokens`
- No schema changes needed

---

## 📋 Deployment Checklist

- [ ] Run `FIX_DECLINE_FUNCTION_CHANGED_BY_CONSTRAINT.sql`
- [ ] Verify function updated (query returns success)
- [ ] Test decline link as external user
- [ ] Verify decline recorded in `approval_tokens`
- [ ] Check job details shows "Declined" status
- [ ] Verify no errors in browser console

---

## ✅ Success Criteria

The fix is successful when:

1. ✅ Decline link works without error
2. ✅ Success page displays
3. ✅ `approval_tokens.decision = 'declined'`
4. ✅ `approval_tokens.decision_at` is set
5. ✅ Job details UI shows declined status
6. ✅ No constraint violation errors

---

**Status:** 🟡 Fix ready, needs to be applied  
**Priority:** 🔴 HIGH (blocks external user decline functionality)  
**Risk:** Low (only removes problematic insert, doesn't affect approvals)

---

**NEXT STEP:** Run `FIX_DECLINE_FUNCTION_CHANGED_BY_CONSTRAINT.sql` now
