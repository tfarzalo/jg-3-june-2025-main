# ✅ DECLINE FUNCTIONALITY - COMPLETE FIX

**Issue:** External users get error when clicking "Decline Extra Charges" link

**Root Cause:** Missing database columns and function

---

## 🚀 Quick Fix (30 seconds)

### Option 1: Simple Version (Recommended)
Copy and run **entire contents** of this file:
```
SIMPLE_FIX_DECLINE.sql
```

### Option 2: Detailed Version (with verification)
Copy and run **entire contents** of this file:
```
COMPLETE_FIX_DECLINE_FUNCTIONALITY_CLEAN.sql
```

---

## What Gets Fixed

✅ Adds 3 missing columns to `approval_tokens`:
- `decision` - Stores 'approved' or 'declined'
- `decision_at` - Timestamp of decision
- `decline_reason` - Optional reason text

✅ Creates `process_decline_token()` function:
- Validates token
- Records decline decision
- Logs phase change
- Returns success/error JSON

✅ Grants permissions:
- Anonymous users (external links)
- Authenticated users

---

## ✅ After Running

1. **Verify Success**
   - Should see "SUCCESS! Function created:" message
   - Shows function name and parameters

2. **Test It**
   - Click a decline link in Extra Charges approval email
   - Should see success page (not error)

3. **Check Database**
   - Token marked as used
   - Decision recorded as 'declined'
   - Job phase unchanged

---

## 🎯 Files

- `SIMPLE_FIX_DECLINE.sql` ⭐ **RUN THIS**
- `COMPLETE_FIX_DECLINE_FUNCTIONALITY_CLEAN.sql` - With verification
- `URGENT_FIX_DECLINE_FUNCTION.md` - Full troubleshooting

---

**Status:** Ready to apply  
**Risk:** Low (only adds missing functionality)  
**Time:** 30 seconds  
**Rollback:** N/A (only adds, doesn't modify existing)
