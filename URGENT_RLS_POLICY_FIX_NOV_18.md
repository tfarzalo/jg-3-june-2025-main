# 🔴 URGENT FIX - RLS Policy Blocking Token Creation

## Problem Identified

**Error:** `new row violates row-level security policy for table "approval_tokens"`

**Root Cause:** The INSERT policy for authenticated users is either:
1. Missing from the database
2. Incorrectly configured
3. Not applied when migration ran

## ✅ IMMEDIATE FIX (2 minutes)

### Option 1: Run Fix Script (Recommended)

1. Open Supabase Dashboard → SQL Editor
2. Open file: `scripts/fix-approval-tokens-rls-policy.sql`
3. Copy entire contents
4. Paste into SQL Editor
5. Click "Run"
6. Look for output: `✅ INSERT SUCCESSFUL!`

If you see that = FIXED! Skip to "Test Again" below.

### Option 2: Quick Manual Fix

If you prefer, just run this in Supabase SQL Editor:

```sql
-- Drop and recreate the INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create approval tokens" ON approval_tokens;

CREATE POLICY "Authenticated users can create approval tokens"
  ON approval_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Verify it was created
SELECT policyname, roles, cmd 
FROM pg_policies 
WHERE tablename = 'approval_tokens' AND cmd = 'INSERT';
```

**Expected output:**
```
policyname: "Authenticated users can create approval tokens"
roles: {authenticated}
cmd: INSERT
```

---

## 🧪 Test Again (1 minute)

After applying the fix:

1. Go back to your app
2. Try sending an approval email again
3. Check console

**Expected:** No more RLS error! Token should create successfully.

---

## 🔍 Why This Happened

The migration file `20250616000001_approval_tokens.sql` has the correct policy definition, BUT:

**Possible reasons it didn't apply:**
1. Migration never ran on your production database
2. Policy was created then accidentally deleted
3. Policy was overwritten by another migration
4. Supabase applied policies in wrong order

**The fix script ensures:** Policy is definitely created with correct permissions.

---

## 📋 After Fix Works

Once token creation succeeds, you should see in console:

```
📅 Token will expire in 7 days: [timestamp]
✅ Created approval token: [uuid]
   Expires at: [timestamp]
   Days until expiration: 7

🔷 PREPARING TO SEND EMAIL
...
```

Then we can address:
- ✅ Token creation (FIXED with this)
- 🔜 Email actually sending
- 🔜 Image variables stripping
- 🔜 Template builder UX

---

## 🆘 If Fix Doesn't Work

If you still get the RLS error after running the fix script:

1. **Check if authenticated:** 
   - Make sure you're logged in to the app
   - Try logging out and back in
   - Check browser console for auth token

2. **Check RLS is enabled:**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'approval_tokens';
   ```
   Should show: `rowsecurity: true`

3. **Check policy exists:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'approval_tokens';
   ```
   Should show 3 policies

4. **Nuclear option** (if nothing works):
   ```sql
   -- Temporarily disable RLS to test
   ALTER TABLE approval_tokens DISABLE ROW LEVEL SECURITY;
   
   -- Try sending email now (should work)
   -- Then re-enable:
   ALTER TABLE approval_tokens ENABLE ROW LEVEL SECURITY;
   ```

---

## ✅ Summary

**Issue:** RLS policy blocking authenticated users from creating tokens  
**Fix:** Run `scripts/fix-approval-tokens-rls-policy.sql`  
**Time:** 2 minutes  
**Then:** Try sending email again  

**This is the blocker** preventing emails from sending. Once fixed, tokens will create and we can see if emails actually send!

---

**Status:** Fix ready to apply  
**Action:** Run the fix script NOW  
**Next:** Test email send again
