# ⚡ QUICK FIX: Decline Function Error

## The Problem
External users clicking "Decline Extra Charges" get error:
> Could not find the function public.process_decline_token

## The Solution (2 minutes)
1. Open Supabase SQL Editor
2. Copy and paste entire contents of `COMPLETE_FIX_DECLINE_FUNCTIONALITY.sql`
3. Click "Run"
4. Done!

This single script fixes BOTH issues:
- Adds missing table columns
- Creates the missing function

## Verify It Worked
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'process_decline_token';
```
Should return 1 row.

## Test It
Click a decline link in an Extra Charges approval email.
Should see success page instead of error.

---

**Files:**
- `FIX_PROCESS_DECLINE_TOKEN_FUNCTION.sql` ← Run this
- `CHECK_APPROVAL_TOKENS_TABLE.sql` ← Run if still errors
- `URGENT_FIX_DECLINE_FUNCTION.md` ← Full troubleshooting guide
