# Testing Notification System - Step by Step

## Issue Report
**Problem:** After applying migration, no notifications appearing in bell icon or dropdown.

## Possible Causes

### 1. **Migration Not Applied to Production Database**
- Migration was applied to local/staging but not production
- **Solution:** Apply migration to production Supabase instance

### 2. **No Frontend Deployment Needed (Database Only)**
The changes are **database-level only**. No code deployment is needed. However:
- The database migration MUST be applied to the production database
- Frontend code doesn't need to change (it already works with the system)

### 3. **You're Testing with Your Own Actions**
- **Expected:** If YOU change a job phase, YOU should NOT see a notification
- **Expected:** If SOMEONE ELSE changes a job phase, YOU SHOULD see a notification
- This is the whole point of the enhancement!

### 4. **You're Not an Admin or JG Management**
- Notifications only go to users with role 'admin' or 'jg_management'
- Subcontractors don't get notifications (by design)

### 5. **Notification Settings Disabled**
- User might have disabled job_phase_change notifications in their profile

---

## Diagnostic Steps

### Step 1: Verify Migration Applied
Run in Supabase SQL Editor:
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name = 'notify_job_phase_change'
  AND routine_schema = 'public';
```

**Expected Result:** Should return 1 row with the function name

**If empty:** Migration not applied to this database

---

### Step 2: Check Your Role
Run in Supabase SQL Editor:
```sql
SELECT 
  full_name,
  email,
  role
FROM profiles
WHERE id = auth.uid();
```

**Expected Result:** Your role should be 'admin' or 'jg_management'

**If different:** You won't receive job phase change notifications (by design)

---

### Step 3: Check Recent Notifications
Run in Supabase SQL Editor:
```sql
SELECT 
  title,
  message,
  type,
  created_at,
  is_read
FROM user_notifications
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Result:** Should show recent notifications (if any were created)

**If empty:** No notifications have been created for you yet

---

### Step 4: Test Notification Creation

#### Option A: Have Another User Make a Change
1. **User A** (you): Login and check bell icon (note current count)
2. **User B** (colleague): Login and change a job phase
3. **User A** (you): Check bell icon again - should show new notification

#### Option B: Manually Test the System
Run in Supabase SQL Editor:
```sql
-- First, check your user ID
SELECT auth.uid() as my_user_id;

-- Then, test the send_notification function directly
SELECT send_notification(
  auth.uid(),  -- your user ID
  'Test Notification',
  'This is a test notification to verify the system works',
  'system',
  NULL,
  NULL
);
```

**Expected Result:** 
1. Function returns a UUID (notification ID)
2. Bell icon shows a new notification
3. Can click bell and see the test notification

---

### Step 5: Check Job Phase Change Trigger
Run in Supabase SQL Editor:
```sql
-- Check if the trigger exists
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'job_phase_change_notification';
```

**Expected Result:** Should return 1 row showing the trigger

**If empty:** Trigger doesn't exist - migration not fully applied

---

### Step 6: Test Complete Flow

1. **Open Supabase SQL Editor**
2. **Run this complete diagnostic:**

```sql
-- Run the complete diagnostic from DIAGNOSTIC_CHECK_NOTIFICATIONS.sql
-- This will show you exactly what's happening in your system
```

3. **Check each section:**
   - Part 1: Functions exist ✅
   - Part 2: Triggers active ✅
   - Part 3: Tables structured correctly ✅
   - Part 4: Recent notifications ✅
   - Part 5: Recent phase changes ✅
   - Part 6: Notifications created for changes ✅
   - Part 7: Your profile and role ✅
   - Part 8: Summary check ✅

---

## Common Issues & Solutions

### Issue 1: "I don't see ANY notifications"
**Diagnosis:**
```sql
SELECT COUNT(*) as total_notifications
FROM user_notifications
WHERE user_id = auth.uid();
```

**If 0:**
- You might be a subcontractor (they don't get notifications)
- No job changes have happened since migration
- Migration not applied to production

**Solution:**
1. Verify your role (should be admin or jg_management)
2. Have someone else make a job change
3. Verify migration applied to production database

---

### Issue 2: "I changed a job and didn't get a notification"
**This is CORRECT behavior!** ✅

The whole point of this enhancement is to prevent self-notifications.

**Expected:**
- You change job → You DON'T see notification ✅
- Others see your change → They DO see notification ✅

**To test:**
- Have a colleague change a job
- Check if YOU see THEIR notification

---

### Issue 3: "Migration applied but still not working"
**Check notification settings:**
```sql
SELECT notification_settings
FROM profiles
WHERE id = auth.uid();
```

**If job_phase_changes is false:**
```sql
-- Enable job phase change notifications
UPDATE profiles
SET notification_settings = jsonb_set(
  COALESCE(notification_settings, '{}'::jsonb),
  '{job_phase_changes}',
  'true'
)
WHERE id = auth.uid();
```

---

### Issue 4: "Frontend not showing notifications"
**Check if Topbar.tsx is running:**

1. Open browser console (F12)
2. Look for any errors
3. Check if Supabase connection is active
4. Verify user is logged in

**Check real-time subscription:**
```javascript
// In browser console
console.log('User ID:', supabase.auth.user()?.id);
```

---

## Quick Test Procedure

### 5-Minute Test
1. ✅ Apply migration to production (if not done)
2. ✅ Run diagnostic SQL (DIAGNOSTIC_CHECK_NOTIFICATIONS.sql)
3. ✅ Create test notification:
   ```sql
   SELECT send_notification(
     auth.uid(),
     'Test',
     'Test notification',
     'system',
     NULL,
     NULL
   );
   ```
4. ✅ Check bell icon - should show notification
5. ✅ Have colleague change a job phase
6. ✅ Check bell icon - should show their change

---

## Expected Behavior Summary

| Action | Your Bell Icon | Other User's Bell Icon | Activity Log |
|--------|----------------|------------------------|--------------|
| You change job phase | 🔔 (no change) | 🔔¹ (new notification) | ✅ Shows change |
| Other changes job phase | 🔔¹ (new notification) | 🔔 (no change) | ✅ Shows change |
| You create work order | 🔔 (no change) | 🔔¹ (new notification) | ✅ Shows creation |
| Other creates work order | 🔔¹ (new notification) | 🔔 (no change) | ✅ Shows creation |

---

## Still Not Working?

### Check Production Database Connection
1. Ensure migration was applied to the **production** Supabase instance
2. Not just local or staging database

### Apply Migration to Production
```bash
# If using Supabase CLI connected to production
supabase db push --project-ref YOUR_PRODUCTION_PROJECT_REF

# Or manually in Supabase Dashboard:
# 1. Go to your production project
# 2. SQL Editor
# 3. Copy/paste migration content
# 4. Run
```

### Verify Application is Connected to Correct Database
Check your environment variables:
```
VITE_SUPABASE_URL=your-production-url
VITE_SUPABASE_ANON_KEY=your-production-key
```

---

## Next Steps

1. **Run:** `DIAGNOSTIC_CHECK_NOTIFICATIONS.sql` in Supabase SQL Editor
2. **Check:** All 8 parts of the diagnostic
3. **Test:** Create a test notification manually
4. **Verify:** Have colleague make a change
5. **Confirm:** You see their notification, not your own

If still having issues after these steps, share the output of the diagnostic SQL and we can troubleshoot further.
