# Daily Agenda Email Cron Investigation & Fix

**Date**: December 11, 2025  
**Issue**: Daily agenda emails not received at scheduled time  
**Status**: ⚠️ INVESTIGATION REQUIRED

---

## Quick Actions Required

### 1. Check Current Cron Status
Run this script in Supabase SQL Editor to check if the cron job ran today:

**File**: `CHECK_CRON_STATUS_AND_HISTORY.sql`

This will show you:
- ✅ If pg_cron is enabled
- ✅ Current cron job configuration
- ✅ Recent execution history (last 10 runs)
- ✅ Today's executions specifically
- ✅ Number of enabled recipients

### 2. Update Cron Schedule to 5:00 AM ET
If the cron schedule needs to be updated (currently may be set to 7:00 AM or 12:00 UTC):

**File**: `UPDATE_CRON_TO_5AM_ET.sql`

This will:
- Remove the old cron job
- Create new job scheduled for **5:00 AM ET** (10:00 UTC during standard time)
- Verify the new schedule

### 3. Update UI Verbiage
**Status**: ✅ **COMPLETED**

Updated `DailyAgendaEmailSettings.tsx` to show clearer information.

**Changes Made**:
- Removed time-specific text from header description
- Kept detailed schedule info in "How it works" section at bottom

**Info Section Now Shows**:
```
How it works:
• Emails are sent automatically at 5:00 AM ET every day
• Email content includes job counts and details for the current day
• Use the test feature above to preview the email format
• Only users with the toggle enabled will receive daily emails
```

---

## Timezone Clarification

### Current Schedule Investigation Needed

The existing cron job may be set to one of these times:
- **12:00 UTC** = 7:00 AM EST / 8:00 AM EDT
- **10:00 UTC** = 5:00 AM EST / 6:00 AM EDT
- **9:00 UTC** = 4:00 AM EST / 5:00 AM EDT

### Recommended: 5:00 AM ET Year-Round

Two options for achieving 5:00 AM ET:

#### Option A: Static 5:00 AM EST (10:00 UTC)
- **Winter (Standard Time)**: 5:00 AM ✓
- **Summer (Daylight Saving)**: 6:00 AM
- **Cron**: `0 10 * * *`

#### Option B: True 5:00 AM Year-Round (9:00 UTC)
- **Winter (Standard Time)**: 4:00 AM
- **Summer (Daylight Saving)**: 5:00 AM ✓
- **Cron**: `0 9 * * *`

**Recommendation**: Use **Option A (10:00 UTC)** for consistency with business hours. Most users prefer slightly later morning emails during winter.

---

## Files Created/Modified

### New Files
1. **`CHECK_CRON_STATUS_AND_HISTORY.sql`**
   - Comprehensive diagnostic script
   - Shows cron job status, history, and recipients
   - Includes interpretation guide

2. **`UPDATE_CRON_TO_5AM_ET.sql`**
   - Updates cron schedule to 5:00 AM ET (10:00 UTC)
   - Includes alternative 9:00 UTC option
   - Has manual test SQL for immediate execution

### Modified Files
1. **`src/components/DailyAgendaEmailSettings.tsx`**
   - Lines 161-167: Updated header description
   - Removed time-specific text from header
   - Schedule info remains in "How it works" section

---

## Troubleshooting Steps

### Step 1: Check if Cron Job Exists and Ran
```sql
-- Run CHECK_CRON_STATUS_AND_HISTORY.sql in Supabase SQL Editor
```

**Look for**:
- `active` should be `true`
- Recent entries in `cron.job_run_details`
- `status` should be `'succeeded'`

### Step 2: Check Edge Function Logs
Go to: Supabase Dashboard → Edge Functions → `send-daily-agenda-email` → Logs

**Look for**:
- Recent function invocations
- HTTP 200 status codes
- Any error messages

### Step 3: Verify Email Recipients
```sql
SELECT 
  p.full_name,
  p.email,
  des.enabled
FROM profiles p
LEFT JOIN daily_email_settings des ON des.user_id = p.id
WHERE p.role IN ('admin', 'manager')
  AND des.enabled = true;
```

### Step 4: Test Email Manually
Option 1 - **Via Admin UI** (Recommended):
1. Go to Admin → Settings → Daily Agenda Email
2. Select "Send to single test email"
3. Enter your email address
4. Click "Send Test Email Now"

Option 2 - **Via SQL**:
```sql
SELECT 
  status,
  content::json->>'message' as result
FROM 
  http((
    'POST',
    'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email',
    ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY')
    ],
    'application/json',
    '{"action": "send_daily_email", "manual": true}'
  )::http_request);
```

---

## Common Issues & Solutions

### Issue 1: Cron Job Not Running
**Symptoms**: No entries in `cron.job_run_details` for today

**Solutions**:
1. Check if `pg_cron` extension is enabled
2. Verify cron job is `active = true`
3. Check database logs for errors
4. Ensure http extension is enabled: `CREATE EXTENSION IF NOT EXISTS http;`

### Issue 2: Cron Runs But No Emails Sent
**Symptoms**: Cron history shows `status = 'succeeded'` but no emails received

**Solutions**:
1. Check Edge Function logs for errors
2. Verify at least one user has `enabled = true` in `daily_email_settings`
3. Check if jobs exist for today's date
4. Verify Resend API key is configured

### Issue 3: Wrong Time Zone
**Symptoms**: Emails arriving at wrong time

**Solutions**:
1. Check current cron schedule: `SELECT schedule FROM cron.job WHERE jobname = 'daily-agenda-email-job'`
2. Update to desired UTC time using `UPDATE_CRON_TO_5AM_ET.sql`
3. Remember: UTC doesn't observe daylight saving

### Issue 4: Duplicate Emails
**Symptoms**: Multiple emails received at same time

**Solutions**:
1. Check for duplicate cron jobs: `SELECT * FROM cron.job WHERE jobname LIKE '%daily%'`
2. Remove duplicates: `SELECT cron.unschedule('duplicate-job-name')`
3. Verify GitHub Actions workflow is removed (should not exist)

---

## Verification Checklist

After running the update scripts, verify:

- [ ] Cron job exists: `SELECT * FROM cron.job WHERE jobname = 'daily-agenda-email-job'`
- [ ] Cron job is active: `active = true`
- [ ] Schedule is correct: `schedule = '0 10 * * *'` (or `'0 9 * * *'`)
- [ ] At least one user has email enabled
- [ ] Test email sends successfully
- [ ] Edge Function logs show no errors
- [ ] Wait for next scheduled run and verify receipt

---

## Next Scheduled Run

After updating to **10:00 UTC** (5:00 AM EST):
- **Next run**: Tomorrow at 5:00 AM EST / 6:00 AM EDT
- **UTC time**: 10:00 UTC
- **Check at**: 5:15 AM ET to verify emails were sent

To see next scheduled run time:
```sql
SELECT 
  jobname,
  schedule,
  NOW() AT TIME ZONE 'UTC' as current_utc_time,
  NOW() AT TIME ZONE 'America/New_York' as current_et_time
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job';
```

---

## Quick Reference

### Cron Schedule Syntax
```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

### Common Schedules
- `0 10 * * *` - Daily at 10:00 UTC (5:00 AM EST)
- `0 9 * * *` - Daily at 9:00 UTC (4:00 AM EST / 5:00 AM EDT)
- `0 10 * * 1-5` - Weekdays only at 10:00 UTC
- `*/5 * * * *` - Every 5 minutes (testing only!)

### Important URLs
- **Supabase SQL Editor**: https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh/sql
- **Edge Function Logs**: https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh/functions/send-daily-agenda-email/logs
- **Cron Jobs**: https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh/database/extensions (search for pg_cron)

---

## Summary

**What to do NOW**:
1. ✅ Run `CHECK_CRON_STATUS_AND_HISTORY.sql` to see current status
2. ✅ Review the execution history to see if cron ran today
3. ⚠️ If no runs today, check Edge Function logs for errors
4. ⚠️ If cron schedule is wrong, run `UPDATE_CRON_TO_5AM_ET.sql`
5. ✅ Test email manually to verify system works
6. ⚠️ Monitor tomorrow's 5:00 AM run to confirm fix

**UI Changes**: ✅ Already updated - verbiage now shows "5:00 AM ET" in the "How it works" section.

**Files to use**:
- **Diagnostic**: `CHECK_CRON_STATUS_AND_HISTORY.sql`
- **Fix Schedule**: `UPDATE_CRON_TO_5AM_ET.sql`
- **UI Component**: `src/components/DailyAgendaEmailSettings.tsx` (already updated)
