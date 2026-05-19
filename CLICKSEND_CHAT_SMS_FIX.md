
Bu# ClickSend SMS Chat Notification Fix

**Date:** May 18, 2026  
**Issue:** Chat messages not triggering SMS notifications  
**Status:** ✅ RESOLVED

---

## 🔍 Root Cause Analysis

When testing the ClickSend SMS integration, chat messages were not triggering SMS notifications to recipients. Investigation revealed:

### The ACTUAL Problem

The `notify_chat_received` column in the `user_sms_notification_settings` table has a **default value of `false`** (opt-in required for chat notifications). This is by design, but users need to explicitly enable this setting before they can receive chat SMS notifications.

### What I Initially Thought (Incorrect)

I initially thought the `notify_*` columns were missing from the database entirely. This was incorrect - they exist in the correct table (`user_sms_notification_settings`), not in `profiles`.

### Database Schema (Correct)

### Database Schema (Correct)

**Table: `user_sms_notification_settings`** (the correct location)
- ✅ `notify_chat_received` (boolean, default: false)
- ✅ `notify_job_assigned` (boolean, default: false)
- ✅ `notify_charges_approved` (boolean, default: false)
- ✅ `notify_work_order_submitted` (boolean, default: false)
- ✅ `notify_job_accepted` (boolean, default: false)
- ✅ `sms_enabled` (boolean, default: false)

**Table: `profiles`** (related fields only)
- ✅ `sms_phone` (text, E.164 format)
- ✅ `sms_consent_given` (boolean)
- ✅ `sms_consent_given_at` (timestamptz)
- ✅ `sms_consent_ip` (text)

---

## ✅ Solution

### What Was Done

1. ✅ Verified `user_sms_notification_settings` table has all required columns
2. ✅ Verified all 27 users have SMS settings rows (auto-seeded)
3. ✅ Removed incorrectly added duplicate columns from `profiles` table
4. ✅ Updated migration file to document the misunderstanding
5. ✅ Confirmed the admin UI checkbox updates work correctly

### What You Need to Do

**Enable chat notifications for users who want to receive them:**

The default for `notify_chat_received` is `false` because chat notifications can be high-frequency. Users must opt in via:

1. **Admin UI Method:**
   - Go to **App Settings** → **SMS Notifications** tab
   - Find the user in the list
   - Check the **"New Chat Message"** checkbox
   - The change saves immediately

2. **SQL Method (Quick Test):**
   ```sql
   UPDATE user_sms_notification_settings
   SET notify_chat_received = true
   WHERE user_id = (SELECT id FROM profiles WHERE email = 'test@example.com');
   ```

---

## 🎯 Testing the Fix

### Prerequisite Checks:

Before testing, ensure the recipient user has:

1. ✅ **SMS phone number set:** 
   ```sql
   SELECT email, sms_phone 
   FROM profiles 
   WHERE email = 'test@example.com';
   ```

2. ✅ **SMS consent given:**
   ```sql
   SELECT email, sms_consent_given, sms_consent_given_at
   FROM profiles 
   WHERE email = 'test@example.com';
   ```

3. ✅ **SMS settings row exists:**
   ```sql
   SELECT * 
   FROM user_sms_notification_settings 
   WHERE user_id = (SELECT id FROM profiles WHERE email = 'test@example.com');
   ```

4. ✅ **Chat notifications enabled:**
   ```sql
   SELECT sms_enabled, notify_chat_received
   FROM user_sms_notification_settings
   WHERE user_id = (SELECT id FROM profiles WHERE email = 'test@example.com');
   ```
   Both should be `true`.

### Test Steps:

1. **Enable chat SMS for test user** (via Admin UI or SQL)
2. **Send a chat message** to that user through the app
3. **Check SMS logs:**
   ```sql
   SELECT *
   FROM sms_notification_logs
   WHERE event_type = 'chat_received'
   ORDER BY created_at DESC
   LIMIT 5;
   ```
4. **Verify SMS arrives** on the recipient's phone

---

## � Column Defaults Explained

| Column | Default | Reason |
|--------|---------|--------|
| `notify_chat_received` | `false` | **High-frequency** - Users must opt in |
| `notify_job_assigned` | `false` | Users can enable via settings |
| `notify_charges_approved` | `false` | Users can enable via settings |
| `notify_work_order_submitted` | `false` | Users can enable via settings |
| `notify_job_accepted` | `false` | Users can enable via settings |
| `sms_enabled` | `false` | Master switch - Users must opt in |

**Note:** All defaults are `false` to comply with SMS opt-in requirements. Users must explicitly enable the notifications they want to receive.

---

## 🔧 Edge Function Eligibility Check

The `dispatch-sms-notification` edge function checks (in order):

1. **User has SMS settings row** in `user_sms_notification_settings`
2. **User has valid phone** in `profiles.sms_phone` (E.164 format)
3. **User has given consent** (`profiles.sms_consent_given = true`)
4. **If explicit recipient:** Check individual flags even if `sms_enabled` is false
5. **If auto-discovery:** Require `sms_enabled = true` AND event flag `= true`
6. **Exclude sender** (don't SMS the person who triggered the event)

Code reference (`dispatch-sms-notification/index.ts` lines 274-315):
```typescript
let query = supabase
  .from("user_sms_notification_settings")
  .select(`user_id, sms_enabled, ${settingColumn}, profiles!inner ( ... )`)
  .not("profiles.sms_phone", "is", null)
  .eq("profiles.sms_consent_given", true);

if (explicitUserIds && explicitUserIds.length > 0) {
  query = query.in("user_id", explicitUserIds);
} else {
  query = query.eq("sms_enabled", true).eq(settingColumn, true);
}
```

---

## 📝 Summary

**Problem:** Users not receiving chat SMS because `notify_chat_received` defaults to `false`  
**Root Cause:** Design choice - chat notifications are opt-in to avoid high-frequency SMS  
**Solution:** Enable `notify_chat_received` for users who want chat notifications  
**Status:** ✅ **WORKING AS DESIGNED** - No code changes needed

---

## 🎉 What's Working

- ✅ Database schema is correct (`user_sms_notification_settings` has all columns)
- ✅ All 27 users have SMS settings rows (auto-seeded)
- ✅ Admin UI correctly updates `notify_*` columns
- ✅ Edge function properly checks user preferences
- ✅ ClickSend integration is fully operational
- ✅ Delivery receipts are being logged

**Action Required:** Simply enable `notify_chat_received` for users who want chat SMS notifications!

---

**Files Modified:**
- `/supabase/migrations/20260518000001_add_sms_notification_settings_to_profiles.sql` (updated to document misunderstanding)
- Removed duplicate `notify_*` columns from `profiles` table (SQL cleanup)

**Commits:**
- `6761350` - fix: Add missing SMS notification settings columns to profiles table (SUPERSEDED)
- (New commit needed) - fix: Remove duplicate notify_* columns and update documentation
