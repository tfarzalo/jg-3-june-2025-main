# Daily Agenda Email - Database Relationship Fix

## 🐛 Issue Found

**Error**: "Could not find a relationship between 'daily_email_settings' and 'profiles' in the schema cache"

**Root Cause**: The `daily_email_settings` table was missing a proper foreign key constraint to the `profiles` table, so PostgREST couldn't establish the relationship for joins.

---

## ✅ Fix Applied

### 1. Database Migration Created

File: `supabase/migrations/20251124000002_fix_daily_email_settings_relationship.sql`

**What it does**:
- Adds proper foreign key constraint from `daily_email_settings.user_id` to `profiles.id`
- Creates indexes for performance
- Sets up RLS policies
- Creates a helper SQL function `get_enabled_email_recipients()` to avoid PostgREST relationship issues

### 2. Edge Function Updated

**Changed**: `supabase/functions/send-daily-agenda-email/index.ts`

**What changed**:
- Now uses `supabase.rpc('get_enabled_email_recipients')` instead of PostgREST joins
- More reliable and avoids schema cache issues
- Better error handling

### 3. Edge Function Deployed ✅

The updated function has been deployed to Supabase.

---

## 📋 Steps to Complete the Fix

### Step 1: Apply the Database Migration

**Option A: Via Supabase Dashboard (Recommended)**
1. Go to Supabase Dashboard → SQL Editor
2. Copy the contents of `APPLY_EMAIL_SETTINGS_FIX.sql`
3. Paste and click "Run"
4. Wait for success message

**Option B: Via Supabase CLI**
```bash
npx supabase db push --project-ref tbwtfimnbmvbgesidbxh
```

### Step 2: Verify the Migration

Run this in Supabase SQL Editor to verify:
```sql
-- Check foreign key exists
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name='daily_email_settings' 
  AND tc.constraint_type = 'FOREIGN KEY';

-- Test the helper function
SELECT * FROM get_enabled_email_recipients();
```

### Step 3: Test the Email Again

1. Go to Admin → Daily Agenda Email Settings
2. Ensure at least one user is enabled (toggle ON)
3. Click "Send Test Email"
4. It should now work! ✅

---

## 🎯 What This Fixes

- ✅ Relationship error between tables
- ✅ Edge Function can now query enabled recipients
- ✅ Test email button will work
- ✅ Automated daily emails will work

---

## 🔍 If You Still Have Issues

Check for these:

1. **Migration not applied**: Run the SQL in `APPLY_EMAIL_SETTINGS_FIX.sql`
2. **No enabled users**: Toggle ON at least one user in settings
3. **No email addresses**: Verify users have valid email in profiles

Run this to check everything:
```sql
-- Check enabled users with emails
SELECT 
  p.full_name,
  p.email,
  p.role,
  des.enabled
FROM daily_email_settings des
JOIN profiles p ON p.id = des.user_id
WHERE des.enabled = true;
```

---

## 📦 Files Created/Modified

### New Files:
- `APPLY_EMAIL_SETTINGS_FIX.sql` - SQL to run in Supabase
- `DAILY_EMAIL_RELATIONSHIP_FIX.md` - This documentation

### Modified Files:
- `supabase/migrations/20251124000002_fix_daily_email_settings_relationship.sql` - Database migration
- `supabase/functions/send-daily-agenda-email/index.ts` - Edge Function update

### Deployed:
- ✅ Edge Function deployed to Supabase
- ⏳ Database migration needs to be applied (see Step 1 above)

---

## 🚀 Next Steps

1. **Apply the SQL migration** (copy from `APPLY_EMAIL_SETTINGS_FIX.sql` and run in Supabase SQL Editor)
2. **Verify it worked** with the test queries above
3. **Try sending a test email** again
4. **Should work perfectly now!** 🎉

---

*Last Updated: November 24, 2024*
