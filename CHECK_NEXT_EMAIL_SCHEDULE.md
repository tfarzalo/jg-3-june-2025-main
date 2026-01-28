# Check Next Daily Agenda Email Schedule

## 🔍 Quick Diagnostic

I've created a comprehensive SQL diagnostic script to check when the next daily agenda email should be sent.

## 📋 How to Run

### Option 1: Run in Supabase SQL Editor (Recommended)

1. **Open Supabase Dashboard:**
   - Go to your project: https://supabase.com/dashboard
   - Navigate to: SQL Editor

2. **Copy and run the diagnostic script:**

```sql
-- Check when the next daily agenda email should be sent

-- 1. Check current timezone and time
SELECT 
  NOW() AS "Current UTC Time",
  NOW() AT TIME ZONE 'America/New_York' AS "Current EST Time",
  CURRENT_DATE AS "Current UTC Date",
  (NOW() AT TIME ZONE 'America/New_York')::date AS "Current EST Date";

-- 2. Check email schedule configuration
SELECT 
  key,
  value,
  description
FROM app_settings
WHERE key LIKE '%email%'
ORDER BY key;

-- 3. Check cron job configuration
SELECT 
  jobid,
  schedule,
  command,
  active,
  jobname
FROM cron.job
WHERE jobname LIKE '%daily%' OR jobname LIKE '%agenda%';

-- 4. Calculate next scheduled run time
WITH schedule_info AS (
  SELECT 
    value::jsonb->>'hour' AS configured_hour,
    value::jsonb->>'timezone' AS configured_timezone
  FROM app_settings
  WHERE key = 'daily_agenda_email_schedule'
),
current_time_info AS (
  SELECT
    NOW() AS current_utc,
    NOW() AT TIME ZONE 'America/New_York' AS current_est,
    (NOW() AT TIME ZONE 'America/New_York')::time AS current_est_time,
    (NOW() AT TIME ZONE 'America/New_York')::date AS current_est_date
)
SELECT
  si.configured_hour || ':00 ' || si.configured_timezone AS "Configured Schedule",
  cti.current_est AS "Current EST Time",
  cti.current_est_time AS "Current EST Time (Time Only)",
  CASE 
    WHEN cti.current_est_time < (si.configured_hour || ':00:00')::time 
    THEN 'Today at ' || si.configured_hour || ':00 EST'
    ELSE 'Tomorrow at ' || si.configured_hour || ':00 EST'
  END AS "Next Email Time (EST)",
  CASE 
    WHEN cti.current_est_time < (si.configured_hour || ':00:00')::time 
    THEN (cti.current_est_date || ' ' || si.configured_hour || ':00:00')::timestamp AT TIME ZONE 'America/New_York'
    ELSE ((cti.current_est_date + INTERVAL '1 day') || ' ' || si.configured_hour || ':00:00')::timestamp AT TIME ZONE 'America/New_York'
  END AS "Next Email Time (UTC)"
FROM schedule_info si, current_time_info cti;

-- 5. Check last email send attempt
SELECT 
  created_at,
  status,
  recipient_count,
  error_message
FROM email_send_log
WHERE email_type = 'daily_agenda'
ORDER BY created_at DESC
LIMIT 5;

-- 6. Check jobs scheduled for today (EST)
WITH today_est AS (
  SELECT (NOW() AT TIME ZONE 'America/New_York')::date AS today
)
SELECT 
  COUNT(*) AS "Jobs Scheduled for Today (EST)",
  COUNT(*) FILTER (WHERE status IN ('Open', 'Scheduled', 'Pending')) AS "Open Jobs",
  COUNT(*) FILTER (WHERE assigned_to IS NOT NULL) AS "Assigned Jobs",
  COUNT(*) FILTER (WHERE assigned_to IS NULL) AS "Unassigned Jobs"
FROM jobs, today_est
WHERE scheduled_date = today_est.today;
```

### Option 2: Run via SQL file

The script has also been saved to: `check_next_email_schedule.sql`

You can run it directly in Supabase SQL Editor.

## 📊 What the Diagnostic Shows

The diagnostic script will provide:

### 1. Current Time Information
- Current UTC time
- Current EST time
- Current dates in both timezones

### 2. Email Schedule Configuration
- Shows all email-related settings from `app_settings` table
- Should show: `daily_agenda_email_schedule` with hour and timezone

### 3. Cron Job Status
- Shows active cron jobs for daily agenda
- Displays: schedule, command, active status

### 4. Next Scheduled Email Time
- **Configured Schedule:** Shows the configured time (e.g., "7:00 EST")
- **Current EST Time:** Shows current time in EST
- **Next Email Time:** Calculates when the next email will be sent
- Shows both EST and UTC timestamps

### 5. Last Email Attempts
- Shows last 5 email send attempts
- Displays: timestamp, status, recipient count, any errors

### 6. Today's Jobs
- Shows count of jobs scheduled for today (in EST)
- Breaks down by: open jobs, assigned jobs, unassigned jobs

## 🎯 Expected Results

If everything is configured correctly, you should see:

```
Configured Schedule: 7:00 America/New_York
Current EST Time: 2026-01-27 [current time]
Next Email Time (EST): [Today/Tomorrow] at 7:00 EST
Next Email Time (UTC): [UTC timestamp]
```

### Cron Schedule Format
The cron job should show:
- **Schedule:** `0 12 * * *` (This is 12:00 UTC = 7:00 EST)
- **Active:** `true`
- **Command:** Should invoke `send-daily-agenda-email` function

## ⚙️ Quick Reference

### Current EST Time vs Email Schedule
- If current time is **before 7:00 AM EST**: Next email is **today at 7:00 AM EST**
- If current time is **after 7:00 AM EST**: Next email is **tomorrow at 7:00 AM EST**

### Timezone Conversion
- **7:00 AM EST** = **12:00 PM UTC** (Standard Time)
- **7:00 AM EDT** = **11:00 AM UTC** (Daylight Saving Time)

Note: The system automatically handles DST transitions.

## 🔧 Troubleshooting

### If email schedule is not configured:
Run the configuration script:
```sql
-- Insert email schedule configuration
INSERT INTO app_settings (key, value, description)
VALUES (
  'daily_agenda_email_schedule',
  '{"hour": "7", "timezone": "America/New_York"}',
  'Daily agenda email schedule configuration'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;
```

### If cron job is not active:
Check the `cron.job` table and ensure:
1. Job exists
2. `active = true`
3. Schedule is correct: `0 12 * * *` (for 7 AM EST)

### If no emails in log:
- Check that cron job is running
- Check Edge Function logs: `supabase functions logs send-daily-agenda-email`
- Verify email recipients are configured in app settings

## 📱 Test Email Manually

To send a test email immediately:

1. Go to: **Dashboard → Settings → Daily Agenda Email**
2. Click: **"Send Test Email"**
3. Check your email inbox

## 📚 Related Documentation

- `DAILY_AGENDA_README.md` - Complete system documentation
- `DAILY_AGENDA_EMAIL_TIMEZONE_FIX.md` - Timezone fix details
- `EMAIL_SCHEDULE_TIMEZONE_FIX_GUIDE.md` - Configuration guide
- `DIAGNOSE_EMAIL_SCHEDULE_ISSUE.sql` - Detailed diagnostic queries

## 🎯 Next Steps

1. Run the diagnostic script above
2. Review the results
3. Check if "Next Email Time" matches your expectations
4. If issues found, refer to troubleshooting section
5. If needed, send a test email to verify configuration

---

**Created:** January 27, 2026  
**Purpose:** Quick diagnostic for daily agenda email scheduling
