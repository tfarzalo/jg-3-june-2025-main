# Daily Agenda Email - Deployment Instructions

## 🎯 Goal
Fix the Daily Agenda email cron job to run at **7:00 AM ET / 4:00 AM PT** and ensure it calls the Edge Function properly.

## ⏰ Schedule Details
- **Time**: 7:00 AM Eastern Time (ET) / 4:00 AM Pacific Time (PT)
- **UTC**: 12:00 PM (noon UTC)
- **Cron**: `0 12 * * *`
- **Frequency**: Daily (including weekends)

## 📋 Step-by-Step Deployment

### Step 1: Run the Fix Migration
1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy and paste the entire contents of `FIX_DAILY_AGENDA_CRON_JOB.sql`
3. Click **Run**

**What this does:**
- Removes the old cron job
- Enables the HTTP extension (needed for making HTTP requests)
- Creates a new cron job scheduled for 7:00 AM ET
- The new job calls the Edge Function via HTTP POST

### Step 2: Verify the Cron Job
Run this query to confirm it's set up correctly:
```sql
SELECT 
  jobid,
  jobname,
  schedule,
  active
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job';
```

**Expected result:**
- `schedule`: `0 12 * * *`
- `active`: `true`

### Step 3: Configure Email Recipients
1. Go to **Admin Settings** in your app
2. Click on **Daily Agenda Email** tab
3. Toggle ON for each user who should receive the daily email
4. Click **Save Settings**

### Step 4: Test Manually (Optional but Recommended)
To test immediately without waiting for tomorrow morning:

1. In Supabase SQL Editor, run:
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
      http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRid3RmaW1uYm12Ymdlc2lkYnhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNDU4MzQ1NiwiZXhwIjoyMDMwMTU5NDU2fQ.3jFPGpOEPwDhAT9fFU_VXZlqGvDOPBx0RHywFnJZ6PA')
    ],
    'application/json',
    '{"action": "send_daily_email", "manual": true}'
  )::http_request);
```

2. **Expected result:**
   - `status`: `200`
   - `result`: `"Daily agenda emails sent successfully"`

3. **Check your email** - Enabled recipients should receive the email within 1-2 minutes

### Step 5: Monitor Tomorrow's Run
The next day (Dec 12, 2025 at 7:00 AM ET), check that it ran:

```sql
SELECT 
  jr.jobid,
  cj.jobname,
  jr.status,
  jr.return_message,
  jr.start_time,
  jr.end_time
FROM cron.job_run_details jr
LEFT JOIN cron.job cj ON cj.jobid = jr.jobid
WHERE cj.jobname = 'daily-agenda-email-job'
ORDER BY jr.start_time DESC
LIMIT 5;
```

**Expected result:**
- `status`: `succeeded`
- `return_message`: Should contain success message (not an error)
- `start_time`: Should be around 12:00 UTC (7:00 AM ET)

## ✅ Success Criteria

The deployment is successful when:
- [ ] Cron job is active with schedule `0 12 * * *`
- [ ] HTTP extension is enabled
- [ ] Manual test sends emails successfully
- [ ] At least one user has `daily_email_settings.enabled = true`
- [ ] Tomorrow morning's scheduled run succeeds
- [ ] Enabled recipients receive the email

## 🚨 Troubleshooting

### Problem: Manual test returns status 500 or error
**Solution:** Check Edge Function logs in Supabase Dashboard → Edge Functions → Logs

### Problem: Status 200 but no emails received
**Solution:** 
1. Verify recipients are enabled:
   ```sql
   SELECT p.email, des.enabled 
   FROM daily_email_settings des
   JOIN profiles p ON p.id = des.user_id
   WHERE des.enabled = true;
   ```
2. Check Edge Function has email sending logic
3. Verify email service API key (Resend, SendGrid, etc.)

### Problem: Cron job shows "failed" status
**Solution:**
1. Check `return_message` for error details
2. Most common: JSON parsing error means Edge Function returned HTML instead of JSON
3. Verify Edge Function URL and service role key are correct

### Problem: Need to change the schedule
**Solution:**
```sql
-- Remove old job
SELECT cron.unschedule('daily-agenda-email-job');

-- Create new job with different time (example: 8 AM ET = 13:00 UTC)
SELECT cron.schedule(
  'daily-agenda-email-job',
  '0 13 * * *',  -- Change this line
  $$
  SELECT status, content::json->>'message' as result
  FROM http((
    'POST',
    'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email',
    ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRid3RmaW1uYm12Ymdlc2lkYnhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNDU4MzQ1NiwiZXhwIjoyMDMwMTU5NDU2fQ.3jFPGpOEPwDhAT9fFU_VXZlqGvDOPBx0RHywFnJZ6PA')
    ],
    'application/json',
    '{"action": "send_daily_email", "manual": false}'
  )::http_request);
  $$
);
```

## 📞 Support

If you encounter issues:
1. Check Edge Function logs in Supabase Dashboard
2. Review cron job execution history with the monitoring query above
3. Verify email recipient settings in Admin Settings → Daily Agenda Email

---

**Deployment Date**: December 11, 2025  
**Schedule**: Daily at 7:00 AM ET / 4:00 AM PT  
**Status**: Ready to deploy 🚀
