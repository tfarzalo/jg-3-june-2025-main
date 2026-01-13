# 🔧 DECLINE FUNCTION FIX - Remove user_notifications

**Issue:** Column `is_read` doesn't exist in `user_notifications`  
**Root Cause:** The approval function doesn't create notifications anymore  
**Solution:** Remove notification creation from decline function

---

## What Changed

The `process_approval_token` function was **updated** and no longer creates `user_notifications` entries. It now:
- ✅ Validates and locks the token
- ✅ Updates the job phase
- ✅ Creates phase change record
- ❌ Does NOT create user_notifications

The decline function needs to match this pattern.

---

## Fixed Version

The new decline function:
- ✅ Validates and locks the token (with race condition protection)
- ✅ Records decline in `approval_tokens` table
- ✅ Logs to `system_logs` (if table exists)
- ✅ Returns success/error response
- ❌ Does NOT create user_notifications
- ❌ Does NOT change job phase (stays in current phase)

---

## Apply the Fix

Run: `FIX_DECLINE_FUNCTION_NO_NOTIFICATIONS.sql`

This will:
1. Drop old function with notification code
2. Create new function matching approval pattern
3. Add proper error handling and locking
4. Verify creation

---

## What Gets Recorded

### ✅ In `approval_tokens` table:
- `used_at` - Timestamp when declined
- `decision` - 'declined'
- `decision_at` - Timestamp of decision
- `decline_reason` - Optional reason text

### ✅ In `system_logs` table (if exists):
- Log entry with decline details
- Job ID, work order number, declined by, reason

### ❌ NOT in `user_notifications`:
- Nothing (table exists but function doesn't use it)

---

## Testing After Fix

1. Run `FIX_DECLINE_FUNCTION_NO_NOTIFICATIONS.sql`
2. Click decline link in approval email
3. Should see success page
4. Verify in database:
   ```sql
   SELECT token, decision, decision_at, decline_reason, used_at
   FROM approval_tokens
   WHERE decision = 'declined'
   ORDER BY decision_at DESC LIMIT 1;
   ```

---

**Status:** Ready to apply  
**Risk:** Low (removes problematic notification code)  
**Impact:** Decline will work, no notifications created (matches approval behavior)
