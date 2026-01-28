# Daily Agenda Email - Quick Diagnostic Guide

## 🎯 Goal
Check when the next daily agenda email will be sent.

## 🚀 Quick Start (2 minutes)

### Option 1: Quick Check (Recommended)
**File:** `QUICK_CHECK_NEXT_EMAIL.sql`

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `QUICK_CHECK_NEXT_EMAIL.sql`
3. Click "Run"
4. Review the output

**What you'll see:**
- ✅ Current time (EST and UTC)
- ✅ Email schedule configuration
- ✅ Cron job status
- ✅ **Next email send time** (THIS IS WHAT YOU WANT!)
- ✅ Last 3 email sends
- ✅ Today's jobs count

### Option 2: Detailed Check
**File:** `check_next_email_schedule.sql`

More detailed diagnostic with explanations.

## 📊 Expected Output

### If Configured Correctly:
```
=== ⏰ Next Email Send Time ===
When: Today (or Tomorrow)
Date: Monday, Jan 27, 2026
Time (EST): 7:00 AM EST
Status Message: ⏰ Email will be sent later today at 7:00 AM EST
```

### Cron Job Status:
```
Cron Status: ✅ Correct (7:00 AM EST)
Cron Expression: 0 12 * * *
Job Active: ✅ Active
```

## 🔍 Understanding the Output

### Cron Expression
- `0 12 * * *` = Every day at 12:00 UTC
- 12:00 UTC = 7:00 AM EST (Standard Time)
- 12:00 UTC = 8:00 AM EDT (Daylight Saving Time)

**Note:** The system automatically handles DST transitions.

### Next Email Logic
- **Before 7:00 AM EST:** Next email is TODAY at 7:00 AM EST
- **After 7:00 AM EST:** Next email is TOMORROW at 7:00 AM EST

### Email Send Log Status
- `✅ Success` - Email sent successfully
- `❌ Error` - Email failed (check error message)
- `⚠️  pending` - Email is being processed

## 🔧 Common Issues & Solutions

### Issue 1: Cron shows wrong time
**Problem:** Cron expression is not `0 12 * * *`

**Solution:**
```sql
-- Fix the cron schedule
SELECT cron.schedule(
  'send-daily-agenda-email',
  '0 12 * * *',  -- 12:00 UTC = 7:00 AM EST
  $$
  SELECT
    net.http_post(
        url := 'https://YOUR_PROJECT.supabase.co/functions/v1/send-daily-agenda-email',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
        body := '{}'::jsonb
    ) as request_id;
  $$
);
```

### Issue 2: Cron job inactive
**Problem:** Job Active shows `❌ Inactive`

**Solution:**
```sql
-- Activate the cron job
UPDATE cron.job
SET active = true
WHERE jobname = 'send-daily-agenda-email';
```

### Issue 3: No configuration found
**Problem:** Email schedule configuration is missing

**Solution:**
```sql
-- Add email schedule configuration
INSERT INTO app_settings (key, value, description)
VALUES (
  'daily_agenda_email_schedule',
  '{"hour": "7", "timezone": "America/New_York"}',
  'Daily agenda email schedule configuration'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;
```

### Issue 4: Last email shows error
**Problem:** Email send log shows errors

**Common causes:**
1. Email template not configured
2. No recipients configured
3. Edge function error
4. Resend API key invalid

**Solution:**
1. Check Edge Function logs:
   ```bash
   supabase functions logs send-daily-agenda-email --tail
   ```
2. Send a test email from the UI (Settings → Daily Agenda Email)
3. Check app_settings for email recipients

## 🧪 Test Email Now

To send a test email immediately (without waiting for scheduled time):

### Option A: Via UI (Easiest)
1. Go to Dashboard → Settings
2. Click "Daily Agenda Email"
3. Click "Send Test Email"
4. Check your inbox

### Option B: Via API
```bash
curl -X POST \
  'https://YOUR_PROJECT.supabase.co/functions/v1/send-daily-agenda-email' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

### Option C: Via SQL (Triggers cron immediately)
```sql
-- Manually trigger the email function
SELECT net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/send-daily-agenda-email',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
);
```

## 📅 Timezone Reference

### EST/EDT Conversion
- **EST (Standard Time):** UTC - 5 hours (Nov - Mar)
- **EDT (Daylight Time):** UTC - 4 hours (Mar - Nov)

### Example Times
| EST Time | EDT Time | UTC Time | Cron Expression |
|----------|----------|----------|-----------------|
| 7:00 AM  | 7:00 AM  | 12:00 PM (EST) / 11:00 AM (EDT) | `0 12 * * *` (EST) / `0 11 * * *` (EDT) |
| 8:00 AM  | 8:00 AM  | 1:00 PM (EST) / 12:00 PM (EDT) | `0 13 * * *` (EST) / `0 12 * * *` (EDT) |

**Our current setup:** `0 12 * * *` which works for **7:00 AM EST** (Standard Time)

**Note:** If you need the email to always send at 7:00 AM regardless of DST, you should use the `America/New_York` timezone in PostgreSQL, not UTC. The current system uses UTC cron with a fixed hour, which means it will shift by 1 hour during DST transitions.

## 🎯 Current Status Check

Run the quick check now to see:
1. ✅ What time it is now (EST)
2. ✅ When the next email will be sent
3. ✅ If the system is working correctly
4. ✅ Last email send attempts

## 📚 Related Documentation

- `DAILY_AGENDA_README.md` - Complete system overview
- `DAILY_AGENDA_EMAIL_TIMEZONE_FIX.md` - Timezone fix details
- `EMAIL_SCHEDULE_TIMEZONE_FIX_GUIDE.md` - Configuration guide
- `DIAGNOSE_EMAIL_SCHEDULE_ISSUE.sql` - Detailed diagnostics
- `QUICK_CHECK_NEXT_EMAIL.sql` - Quick status check (USE THIS ONE!)
- `check_next_email_schedule.sql` - Alternative diagnostic

## 🎬 Next Steps

1. ✅ Run `QUICK_CHECK_NEXT_EMAIL.sql` in Supabase SQL Editor
2. ✅ Review "Next Email Send Time" section
3. ✅ Verify cron job is active and correctly scheduled
4. ✅ Check last email sends for any errors
5. ✅ (Optional) Send a test email to verify configuration

---

**Created:** January 27, 2026  
**Purpose:** Quick reference for checking daily agenda email schedule  
**Time to complete:** ~2 minutes
