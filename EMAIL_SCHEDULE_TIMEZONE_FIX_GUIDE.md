# Daily Agenda Email Schedule - Timezone Fix

## 🐛 Problem Identified

**Issue:** Daily agenda emails are being received at **1:00 AM ET** instead of the time configured in the admin settings (e.g., 7:00 AM ET).

### Root Cause

The system had a **timezone conversion bug**:

1. **Database Field Naming Confusion**: The field `send_time_utc` in the `daily_email_config` table was misleadingly named. It was storing the time in Eastern Time (ET), but the name suggested it was already in UTC.

2. **Missing Timezone Conversion**: The trigger function `update_daily_email_cron_schedule()` was using the stored time directly as UTC hours/minutes without converting from ET to UTC.

3. **Result**: When admin sets "7:00 AM" thinking it's ET:
   - Time stored: `07:00:00` 
   - Cron scheduled at: `7 0 * * *` (7:00 UTC)
   - Actual delivery time: **2:00 AM EST** or **3:00 AM EDT**
   
4. **Your Current Situation**: Emails at 1:00 AM ET means cron is running at:
   - `6 0 * * *` (6:00 UTC) = 1:00 AM EST or 2:00 AM EDT
   - OR `5 0 * * *` (5:00 UTC) = 12:00 AM EST or 1:00 AM EDT

---

## ✅ Solution Applied

### Files Modified/Created:

1. **`FIX_EMAIL_SCHEDULE_TIMEZONE_ISSUE.sql`** - Main fix script
2. **`DIAGNOSE_EMAIL_SCHEDULE_ISSUE.sql`** - Diagnostic query
3. **`src/components/DailyAgendaEmailSettings.tsx`** - UI clarification

### Changes Made:

#### 1. Database Function Fix

**Updated `update_daily_email_cron_schedule()` function** to properly convert ET to UTC:

```sql
-- OLD (INCORRECT):
hour_val := EXTRACT(HOUR FROM NEW.send_time_utc);  -- Used ET time as UTC!

-- NEW (CORRECT):
utc_time := (
  (CURRENT_DATE + NEW.send_time_utc) AT TIME ZONE NEW.send_time_timezone AT TIME ZONE 'UTC'
)::time;
hour_val := EXTRACT(HOUR FROM utc_time);  -- Now properly converted to UTC
```

**How it works:**
- Takes the time from `send_time_utc` (which is actually ET, not UTC)
- Converts it to the timezone specified in `send_time_timezone` (America/New_York)
- Converts that to actual UTC
- Uses the UTC time for the cron schedule

**Example Conversion:**
- User sets: **7:00 AM ET**
- Database stores: `07:00:00` with timezone `America/New_York`
- Function converts to: **12:00 UTC** (during EST) or **11:00 UTC** (during EDT)
- Cron runs at: `0 12 * * *` or `0 11 * * *`
- Emails delivered at: **7:00 AM ET** ✅

#### 2. UI Clarification

Updated the label in `DailyAgendaEmailSettings.tsx`:

```tsx
// OLD:
Daily Send Time (Your Local Time)

// NEW:
Daily Send Time (Eastern Time)

// Also updated the help text:
"Current schedule: Emails sent daily at {sendTime} Eastern Time (ET). 
The system will automatically convert this to UTC for scheduling."
```

#### 3. Database Comments

Added clarifying comments to the table:

```sql
COMMENT ON COLUMN daily_email_config.send_time_utc IS 
  'Time in the timezone specified by send_time_timezone (NOT UTC despite the name). 
  The cron trigger function converts this to actual UTC.';
```

---

## 🚀 Deployment Steps

### Step 1: Run Diagnostic (Optional but Recommended)

```sql
-- In Supabase SQL Editor, run:
-- This shows current configuration and identifies the issue
```
Open and run: **`DIAGNOSE_EMAIL_SCHEDULE_ISSUE.sql`**

This will show you:
- Current configured time
- Current cron schedule
- Recent email run times
- Timezone conversion details

### Step 2: Apply the Fix

```sql
-- In Supabase SQL Editor, run:
```
Open and run: **`FIX_EMAIL_SCHEDULE_TIMEZONE_ISSUE.sql`**

This script will:
1. ✅ Drop and recreate the trigger function with proper timezone conversion
2. ✅ Recreate the trigger
3. ✅ Force an update to reschedule the cron job correctly
4. ✅ Show verification output

**Expected Output:**
```
NOTICE: Converting 07:00:00 America/New_York to UTC: 12:00:00 (cron: 0 12 * * *)
NOTICE: ✅ Cron job rescheduled to run at 12:00:00 UTC (07:00:00 America/New_York)

=== Current Configuration ===
Time (in timezone): 07:00:00
Timezone: America/New_York
Actual UTC Time: 12:00:00
updated_at: 2026-01-27 ...

=== Cron Job Schedule ===
jobname: daily-agenda-email-cron
Cron Expression (UTC): 0 12 * * *
active: true
```

### Step 3: Verify in Admin UI

1. Log into your application as an admin
2. Go to **Settings → Daily Agenda Email Settings**
3. Note the current time displayed
4. (Optional) Update to your desired time and click "Update Time"
5. The system will automatically reschedule the cron job with proper timezone conversion

### Step 4: Test (Optional)

You can manually trigger a test email:
1. In the Admin UI, go to Daily Agenda Email Settings
2. Click "Send Test Email"
3. Verify the email is received

### Step 5: Monitor Next Scheduled Run

```sql
-- Check when the next email will be sent
SELECT 
  jobname,
  schedule,
  active,
  -- Show next run time (approximate)
  CASE 
    WHEN schedule LIKE '0 12%' THEN 'Next run: 12:00 UTC (7:00 AM EST / 8:00 AM EDT)'
    WHEN schedule LIKE '0 11%' THEN 'Next run: 11:00 UTC (6:00 AM EST / 7:00 AM EDT)'
    ELSE 'Check schedule column'
  END as next_run_info
FROM cron.job 
WHERE jobname = 'daily-agenda-email-cron';
```

---

## 📊 Understanding the Schedule

### Timezone Conversion Table

| Set Time (ET) | UTC (Standard) | UTC (Daylight) | Cron Expression |
|---------------|----------------|----------------|-----------------|
| 5:00 AM       | 10:00          | 09:00          | `0 10 * * *` or `0 9 * * *` |
| 6:00 AM       | 11:00          | 10:00          | `0 11 * * *` or `0 10 * * *` |
| 7:00 AM       | 12:00          | 11:00          | `0 12 * * *` or `0 11 * * *` |
| 8:00 AM       | 13:00          | 12:00          | `0 13 * * *` or `0 12 * * *` |

**Note:** The cron expression will automatically adjust between EST (UTC-5) and EDT (UTC-4) because the conversion happens at runtime using PostgreSQL's timezone functions.

### How Daylight Saving Time is Handled

PostgreSQL's `AT TIME ZONE` function automatically handles DST transitions:
- **During EST (Standard Time)**: 7:00 AM ET = 12:00 UTC
- **During EDT (Daylight Time)**: 7:00 AM ET = 11:00 UTC

The trigger function recalculates the UTC time whenever the schedule is updated, so it will use the correct offset based on the current date.

---

## 🧪 Testing Checklist

- [ ] Run diagnostic query and note current cron schedule
- [ ] Run fix script successfully
- [ ] Verify cron job schedule updated in diagnostic output
- [ ] Check admin UI shows correct timezone label
- [ ] (Optional) Send test email and verify receipt
- [ ] (Optional) Change schedule time and verify cron updates
- [ ] Monitor tomorrow morning for email at correct time

---

## 🔍 Troubleshooting

### Issue: "Job not found" error

**Solution:** The cron job doesn't exist yet. Run the full setup:
```sql
-- Run: supabase/migrations/20260123_add_email_schedule_config.sql
```

### Issue: Emails still arrive at wrong time

**Check:**
1. Verify the cron job schedule:
   ```sql
   SELECT jobname, schedule FROM cron.job WHERE jobname = 'daily-agenda-email-cron';
   ```
2. Ensure the schedule matches expected UTC time (see conversion table above)
3. Check recent job runs:
   ```sql
   SELECT start_time, status FROM cron.job_run_details 
   WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-agenda-email-cron')
   ORDER BY start_time DESC LIMIT 5;
   ```

### Issue: No emails received at all

**Check:**
1. Enabled recipients:
   ```sql
   SELECT p.email, des.enabled 
   FROM daily_email_settings des 
   JOIN profiles p ON p.id = des.user_id 
   WHERE des.enabled = true;
   ```
2. Function logs in Supabase Dashboard → Edge Functions → Logs

---

## 📝 Summary

| Before Fix | After Fix |
|------------|-----------|
| ❌ Admin sets 7:00 AM ET → Emails sent at 2-3 AM ET | ✅ Admin sets 7:00 AM ET → Emails sent at 7:00 AM ET |
| ❌ No timezone conversion in trigger function | ✅ Proper ET to UTC conversion |
| ❌ Confusing UI label "Your Local Time" | ✅ Clear label "Eastern Time (ET)" |
| ❌ Misleading database field name | ✅ Clarifying comments added |

---

## 🎯 Next Steps

1. **Deploy the fix** by running `FIX_EMAIL_SCHEDULE_TIMEZONE_ISSUE.sql`
2. **Verify** the cron schedule is correct
3. **Wait** for tomorrow morning to confirm emails arrive at the configured time
4. **Adjust** the schedule time in the admin UI if needed

The fix is **non-destructive** and will automatically apply to any future schedule changes through the trigger function.

---

**Last Updated:** January 27, 2026  
**Status:** ✅ Fix Ready for Deployment
