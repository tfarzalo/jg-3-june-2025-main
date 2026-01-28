# ✅ Testing Checklist - Dynamic Email Schedule

## Status: Ready to Test! 🚀

### What's Been Completed:
- ✅ Database table `daily_email_config` created
- ✅ Trigger function created with SECURITY DEFINER
- ✅ Trigger configured to auto-reschedule cron
- ✅ RLS policies set up (admin-only)
- ✅ UI component updated with time picker
- ✅ Permission fix applied

---

## Test Now in Admin UI

### Step 1: Access the Settings
1. Navigate to `/admin` in your application
2. Click on **"Daily Agenda Email Settings"**
3. You should see the **"Email Schedule"** section at the top

### Step 2: Test Changing the Time
1. Current time should show: **12:00** (noon UTC / 7:00 AM EST)
2. Click the time picker input
3. Select a different time (e.g., **14:00** / 2:00 PM)
4. Click **"Update Time"** button

### Step 3: Expected Results
✅ **Success Message:** "Daily email time updated to 14:00. Cron job will be rescheduled automatically."
✅ **No errors** in browser console
✅ **Time picker** updates to show new time

### Step 4: Verify in Database (Optional)
Run this query to confirm the update:
```sql
SELECT 
  send_time_utc,
  updated_at,
  'Current schedule' as status
FROM daily_email_config;
```

Should show your new time (e.g., `14:00:00`)

---

## What to Watch For

### ✅ Good Signs:
- Success toast notification appears
- No red error messages
- Time picker shows new time
- Page doesn't reload/crash

### ❌ If You See Errors:
- Check browser console (F12)
- Look at Network tab for error details
- Copy error message and we'll debug

---

## After Successful Test

### Verify Cron Rescheduled (Optional):
**Via Supabase Dashboard:**
1. Go to Dashboard → Database → Extensions
2. Find `pg_cron` extension
3. Look for job: `daily-agenda-email-cron`
4. Schedule should match your new time (e.g., `0 14 * * *` for 2:00 PM)

**Via SQL (if you have permissions):**
```sql
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'daily-agenda-email-cron';
```

---

## Test Different Times

Try changing to various times to ensure it works consistently:

1. **Morning:** 07:00 (7:00 AM)
2. **Afternoon:** 14:00 (2:00 PM)
3. **Evening:** 18:00 (6:00 PM)
4. **Midnight:** 00:00 (midnight)

Each time:
- Click Update
- Verify success message
- Check database if needed

---

## Final Verification

### Full End-to-End Test (Optional but Recommended):

1. **Set time to 5 minutes from now**
   - Example: If it's 3:42 PM, set to 15:47 (3:47 PM)

2. **Wait for the scheduled time**
   - Monitor for 5-6 minutes

3. **Check email logs**
   ```sql
   SELECT * FROM daily_summary_log 
   WHERE sent_at >= NOW() - INTERVAL '10 minutes'
   ORDER BY sent_at DESC;
   ```

4. **Verify emails sent**
   - Should see new entries at approximately your scheduled time
   - Check `success` column is `true`

---

## What Happens Behind the Scenes

When you click "Update Time":

```
1. UI sends update to database
   ↓
2. daily_email_config table updated
   ↓
3. Database trigger fires
   ↓
4. update_daily_email_cron_schedule() runs
   ↓
5. Unschedules old cron job
   ↓
6. Schedules new cron job with new time
   ↓
7. Returns success to UI
   ↓
8. Toast notification shown
```

All automatic! 🎉

---

## Troubleshooting

### Issue: "Permission denied" error still appears
**Solution:** Make sure you ran `fix_cron_permissions.sql` completely
```sql
-- Verify function has SECURITY DEFINER:
SELECT proname, prosecdef 
FROM pg_proc 
WHERE proname = 'update_daily_email_cron_schedule';
-- prosecdef should be 't' (true)
```

### Issue: "Failed to update" generic error
**Solution:** Check browser console for specific error, verify you're logged in as admin

### Issue: Success message but time doesn't change
**Solution:** Hard refresh the page (Cmd+Shift+R / Ctrl+Shift+R)

---

## Success Criteria

You'll know it's working when:

- ✅ Can change time in UI without errors
- ✅ Success toast appears
- ✅ Database shows updated time
- ✅ Cron job reschedules (visible in Dashboard)
- ✅ Emails eventually send at new time

---

## 🎉 Ready to Test!

Go ahead and test it now in the admin UI. Let me know if you:
- ✅ Get success messages
- ❌ Encounter any errors
- ℹ️ Have questions about how it works

**Good luck!** 🚀
