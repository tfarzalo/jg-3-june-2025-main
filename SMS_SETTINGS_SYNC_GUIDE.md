# SMS Settings Synchronization Guide

## Overview

The SMS notification system maintains **bidirectional synchronization** between two database tables to ensure consistency and TCPA compliance:

1. **`profiles.sms_consent_given`** - User's explicit TCPA consent for receiving SMS
2. **`user_sms_notification_settings.sms_enabled`** - Master toggle for SMS notifications

These two fields are kept in sync automatically whenever either is changed through the UI or API.

---

## Database Schema

### profiles table
```sql
- sms_consent_given (boolean) - TCPA consent flag
- sms_consent_given_at (timestamptz) - When consent was given/revoked
- sms_phone (text) - E.164 formatted phone number
```

### user_sms_notification_settings table
```sql
- user_id (uuid, PK) - References profiles.id
- sms_enabled (boolean) - Master SMS toggle
- notify_chat_received (boolean)
- notify_job_assigned (boolean)
- notify_charges_approved (boolean)
- notify_work_order_submitted (boolean)
- notify_job_accepted (boolean)
```

---

## Sync Mechanisms

### 1. User Profile → SMS Settings Sync

**Location:** `/src/components/UserProfile.tsx`

When a user updates their SMS consent in their profile:

```typescript
// After updating profiles table
const { error: smsSettingsError } = await supabase
  .from('user_sms_notification_settings')
  .upsert({
    user_id: profile.id,
    sms_enabled: profile.sms_consent_given,
  }, { onConflict: 'user_id' });
```

**Trigger:** User toggles "I consent to receive SMS..." checkbox in their profile

**Effect:** 
- ✅ `profiles.sms_consent_given` is updated
- ✅ `profiles.sms_consent_given_at` is set/cleared
- ✅ `user_sms_notification_settings.sms_enabled` is synced

---

### 2. SMS Settings → User Profile Sync

**Location:** `/src/lib/sms/smsNotificationSettings.ts`

When SMS settings are changed (by user OR admin):

#### User's Own Settings
```typescript
// In upsertOwnSmsSettings()
if ('sms_enabled' in updates) {
  await supabase
    .from('profiles')
    .update({
      sms_consent_given: updates.sms_enabled,
      sms_consent_given_at: updates.sms_enabled ? new Date().toISOString() : null,
    })
    .eq('id', user.id);
}
```

#### Admin Updates
```typescript
// In adminUpsertSmsSettings()
if ('sms_enabled' in updates) {
  await supabase
    .from('profiles')
    .update({
      sms_consent_given: updates.sms_enabled,
      sms_consent_given_at: updates.sms_enabled ? new Date().toISOString() : null,
    })
    .eq('id', userId);
}
```

**Triggers:** 
- User toggles SMS master switch in their settings
- Admin toggles SMS master switch in admin panel

**Effect:** 
- ✅ `user_sms_notification_settings.sms_enabled` is updated
- ✅ `profiles.sms_consent_given` is synced
- ✅ `profiles.sms_consent_given_at` is set/cleared

---

## User Interfaces

### 1. User Profile Settings
**Path:** Profile → Edit Profile → SMS Phone section

**What users see:**
- SMS consent checkbox with TCPA disclosure
- SMS phone number field
- Consent timestamp (if given)

**What they can control:**
- Give/revoke SMS consent
- Set their SMS phone number

---

### 2. Admin SMS Settings Panel
**Path:** App Settings → SMS Notifications tab (admin only)

**What admins see:**
- List of all SMS-eligible users grouped by role
- Each user shows:
  - Name, email, role badge
  - SMS phone number (from profiles)
  - Master "SMS Enabled" toggle (syncs with consent)
  - Individual event checkboxes (filtered by role)

**What admins can control:**
- Toggle SMS enabled/disabled for any user
- Toggle specific notification types per user
- View who has SMS configured

**ClickSend Info Banner:**
- Shows SMS platform details
- Message limits and delivery tracking info

---

## Verification Steps

### 1. Check User Profile Sync

1. Go to user's profile
2. Toggle "I consent to receive SMS..." checkbox
3. Save profile
4. Run this query to verify sync:

```sql
SELECT 
  p.email,
  p.sms_consent_given,
  p.sms_consent_given_at,
  s.sms_enabled,
  s.updated_at
FROM profiles p
LEFT JOIN user_sms_notification_settings s ON p.id = s.user_id
WHERE p.email = 'test@example.com';
```

**Expected result:**
- `sms_consent_given` = `sms_enabled` ✅
- If TRUE: `sms_consent_given_at` should have a timestamp
- If FALSE: `sms_consent_given_at` should be NULL

---

### 2. Check Admin Panel Sync

1. Go to App Settings → SMS Notifications
2. Find a test user
3. Toggle their master "SMS" switch
4. Run the same query above
5. Go to that user's profile and verify the consent checkbox matches

**Expected result:**
- Toggle shows correct current state
- Clicking toggle updates both tables
- Profile checkbox reflects admin's change

---

### 3. Check Browser Console

After toggling any SMS setting:

```javascript
// Should see successful updates, no errors
// Example success messages:
[smsNotificationSettings] Successfully synced sms_consent_given
[UserProfile] Profile updated successfully
```

**No errors should appear related to:**
- RLS policies
- Permission denied
- Constraint violations

---

## Common Issues & Solutions

### Issue: Toggle doesn't reflect database state

**Symptoms:**
- Toggle shows ON but database has FALSE (or vice versa)
- Toggle changes but reverts immediately

**Solution:**
1. Check browser console for errors
2. Verify user has required permissions
3. Check that both sync blocks are present in code:
   - `upsertOwnSmsSettings()` in smsNotificationSettings.ts
   - `adminUpsertSmsSettings()` in smsNotificationSettings.ts
   - Profile update handler in UserProfile.tsx

---

### Issue: Admin toggle doesn't update user's profile

**Symptoms:**
- Admin changes toggle in SMS settings
- User's profile still shows old consent state

**Solution:**
Verify `adminUpsertSmsSettings()` includes this block:

```typescript
if ('sms_enabled' in updates) {
  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      sms_consent_given: updates.sms_enabled,
      sms_consent_given_at: updates.sms_enabled ? new Date().toISOString() : null,
    })
    .eq('id', userId);
}
```

---

### Issue: User profile consent doesn't update SMS settings

**Symptoms:**
- User toggles consent in profile
- Admin panel still shows old state

**Solution:**
Verify UserProfile.tsx `handleSubmit()` includes this block:

```typescript
const { error: smsSettingsError } = await supabase
  .from('user_sms_notification_settings')
  .upsert({
    user_id: profile.id,
    sms_enabled: profile.sms_consent_given,
  }, { onConflict: 'user_id' });
```

---

## Real-time Updates

The admin panel subscribes to real-time changes:

```typescript
// From useSmsNotificationSettings.ts
const channel = subscribeSmsSettings(userId, (updated) => {
  setSettings(updated);
});
```

This ensures:
- ✅ Multi-admin scenarios stay in sync
- ✅ Changes appear immediately without page refresh
- ✅ Optimistic updates are corrected if server rejects

---

## SMS Delivery Logic

For an SMS to be sent, **ALL** of these must be true:

1. ✅ `profiles.sms_phone` is a valid E.164 number
2. ✅ `profiles.sms_consent_given = true` (TCPA compliance)
3. ✅ `user_sms_notification_settings.sms_enabled = true` (master toggle)
4. ✅ Specific event flag is true (e.g., `notify_chat_received`)

The sync ensures conditions 2 and 3 are always aligned.

---

## Testing Checklist

### User Flow
- [ ] Toggle consent in profile → check admin panel updates
- [ ] Untoggle consent in profile → check admin panel updates
- [ ] Set SMS phone → check it appears in admin panel
- [ ] Clear SMS phone → check warning appears in admin panel

### Admin Flow
- [ ] Toggle SMS enabled in admin panel → check user profile updates
- [ ] Disable SMS in admin panel → check user profile consent clears
- [ ] Toggle individual event types → check they persist
- [ ] Refresh page → check all toggles maintain state

### Database Integrity
```sql
-- Should return 0 rows (no mismatches)
SELECT 
  p.email,
  p.sms_consent_given,
  s.sms_enabled
FROM profiles p
INNER JOIN user_sms_notification_settings s ON p.id = s.user_id
WHERE p.sms_consent_given != s.sms_enabled;
```

---

## Migration Notes

All sync logic was added in the ClickSend migration. If you encounter any users with mismatched states, run this repair query:

```sql
-- Sync profiles.sms_consent_given to match user_sms_notification_settings.sms_enabled
UPDATE profiles p
SET 
  sms_consent_given = s.sms_enabled,
  sms_consent_given_at = CASE 
    WHEN s.sms_enabled THEN COALESCE(p.sms_consent_given_at, NOW())
    ELSE NULL
  END
FROM user_sms_notification_settings s
WHERE p.id = s.user_id
  AND p.sms_consent_given != s.sms_enabled;
```

---

## Code Locations Reference

| Component | File | Purpose |
|-----------|------|---------|
| User profile consent | `src/components/UserProfile.tsx` | User toggles SMS consent |
| Admin SMS panel | `src/components/SmsNotificationSettings.tsx` | Admin manages all users' SMS settings |
| SMS settings hook | `src/hooks/useSmsNotificationSettings.ts` | React hook for user's own settings |
| Data access layer | `src/lib/sms/smsNotificationSettings.ts` | All DB operations and sync logic |
| Type definitions | `src/types/sms.ts` | Shared types and constants |
| SMS dispatcher | `src/lib/sms/dispatchSmsNotification.ts` | Sends notifications via ClickSend |

---

## Support

If sync issues persist:

1. Check browser console for errors
2. Check Supabase logs for RLS policy rejections
3. Verify both tables have matching user_id
4. Run the database integrity query above
5. Check that all sync code blocks are present

For ClickSend-specific issues, see `CLICKSEND_TROUBLESHOOTING.md`.
