# 🚨 URGENT FIX: Process Decline Token Function Missing

**Date:** December 11, 2025  
**Issue:** External users clicking "Decline Extra Charges" link get error  
**Error Message:** `Could not find the function public.process_decline_token(p_decline_reason, p_token) in the schema cache`

---

## 🎯 Root Cause

The `process_decline_token` database function was defined in migration file `20251211000001_add_extra_charges_approval_decline.sql` but **the migration has not been applied** to the production database.

---

## ⚡ IMMEDIATE FIX (2 minutes)

### ONE-STEP FIX: Run Complete Fix Script

Copy and run the **entire contents** of this file in Supabase SQL Editor:
```
COMPLETE_FIX_DECLINE_FUNCTIONALITY.sql
```

This single script will:
1. ✅ Add missing columns to `approval_tokens` table (decision, decision_at, decline_reason)
2. ✅ Create the `process_decline_token` function with correct signature
3. ✅ Grant permissions to anonymous and authenticated users
4. ✅ Verify everything was created successfully

### Alternative: Step-by-Step Fix

If you prefer to run fixes separately:

**Step 1:** Run `FIX_APPROVAL_TOKENS_TABLE.sql`
- Adds missing columns to approval_tokens table

**Step 2:** Run `FIX_PROCESS_DECLINE_TOKEN_FUNCTION.sql`
- Creates the decline function

### Step 3: Verify the Fix
After running the fix, verify with:

```sql
-- Should return 1 row showing the function exists
SELECT 
  routine_name,
  pg_get_function_arguments(p.oid) as arguments
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
WHERE routine_schema = 'public'
  AND routine_name = 'process_decline_token';
```

**Expected Output:**
```
routine_name: process_decline_token
arguments: p_token character varying, p_decline_reason text DEFAULT NULL::text
```

### Step 4: Test Externally
1. Send yourself a test Extra Charges approval email
2. Click the "Decline" link
3. Should now see success page instead of error

---

## 🔍 Additional Verification

### Check approval_tokens Table
The function also requires the `approval_tokens` table to have these columns:
- `decision` (varchar)
- `decision_at` (timestamptz)
- `decline_reason` (text)

Run this to verify:
```
CHECK_APPROVAL_TOKENS_TABLE.sql
```

If columns are missing, uncomment and run the ALTER TABLE section in that file.

---

## 📋 Full Deployment Checklist

- [ ] Run `FIX_PROCESS_DECLINE_TOKEN_FUNCTION.sql`
- [ ] Verify function exists (Step 3 above)
- [ ] Run `CHECK_APPROVAL_TOKENS_TABLE.sql`
- [ ] Verify `approval_tokens` has `decision`, `decision_at`, `decline_reason` columns
- [ ] Test decline link as external user
- [ ] Verify decline shows in job details with reason
- [ ] Check internal notification email was sent (if configured)

---

## 🔧 If Still Getting Errors

### Error: "Column does not exist"
**Problem:** `approval_tokens` table is missing the new columns

**Fix:** Run the ALTER TABLE in `CHECK_APPROVAL_TOKENS_TABLE.sql`:
```sql
ALTER TABLE approval_tokens
ADD COLUMN IF NOT EXISTS decision VARCHAR(20) CHECK (decision IN ('approved', 'declined')),
ADD COLUMN IF NOT EXISTS decision_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS decline_reason TEXT;
```

### Error: "Function still not found"
**Problem:** Supabase schema cache needs refresh

**Fix:**
1. Go to Supabase Dashboard
2. Settings → General
3. Click "Restart project"
4. Wait 2-3 minutes for restart
5. Try decline link again

### Error: "Permission denied"
**Problem:** Anonymous users don't have execute permission

**Fix:** Grant permissions:
```sql
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.process_decline_token(VARCHAR, TEXT) TO authenticated;
```

---

## 🎯 Related Files

### SQL Fixes
- `FIX_PROCESS_DECLINE_TOKEN_FUNCTION.sql` - Creates the function
- `CHECK_APPROVAL_TOKENS_TABLE.sql` - Verifies table schema
- `supabase/migrations/20251211000001_add_extra_charges_approval_decline.sql` - Original migration

### Frontend
- `src/pages/ApprovalPage.tsx` - Calls the function on line 401

### Documentation
- `docs/extra-charges-approval-decline-flow.md` - Full workflow documentation
- `EXTRA_CHARGES_APPROVAL_DECLINE_DEPLOYMENT_CHECKLIST.md` - Deployment guide

---

## 📊 Testing Checklist

After applying the fix:

- [ ] **Basic Test:** Click decline link → See success page
- [ ] **Token Marked Used:** Check `approval_tokens.used_at` is set
- [ ] **Decision Recorded:** Check `approval_tokens.decision = 'declined'`
- [ ] **Reason Stored:** If provided, check `approval_tokens.decline_reason`
- [ ] **Job Phase Unchanged:** Job stays in current phase (e.g., "Pending Work Order")
- [ ] **Phase Change Log:** Check `job_phase_changes` has decline log entry
- [ ] **UI Shows Declined:** Job details page shows "Extra Charges: Declined"
- [ ] **Internal Notification:** Admin/manager receives notification email (if configured)

---

## 🚀 Prevention

To prevent this in the future:

1. **Always apply migrations** after creating them
2. **Test all database functions** in staging before production
3. **Verify external links work** before sending to clients
4. **Use deployment checklist** (EXTRA_CHARGES_APPROVAL_DECLINE_DEPLOYMENT_CHECKLIST.md)

---

## ✅ Success Criteria

The fix is successful when:

1. ✅ Function appears in database schema
2. ✅ External users can click decline link without error
3. ✅ Decline decision is recorded in database
4. ✅ Job phase remains unchanged
5. ✅ Decline shows in job details UI
6. ✅ Internal notification email is sent (if configured)

---

**Priority:** 🔴 CRITICAL  
**Impact:** External users cannot decline Extra Charges  
**Fix Time:** 5 minutes  
**Risk:** Low (only creates missing function, doesn't modify existing data)

---

**NEXT STEP:** Run `FIX_PROCESS_DECLINE_TOKEN_FUNCTION.sql` in Supabase SQL Editor NOW
