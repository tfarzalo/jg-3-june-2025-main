# 📋 STEP-BY-STEP: Daily Agenda Email Automation Setup

## ✅ **Implementation Complete!**

All code has been implemented. Now follow these manual steps to deploy and activate the system.

---

## 📦 **What Was Created**

### New Files:
1. ✅ `supabase/migrations/20260123_daily_summary_tracking.sql` - Email tracking table
2. ✅ `supabase/functions/daily-agenda-cron-trigger/index.ts` - Cron trigger function
3. ✅ `supabase/migrations/20260123_setup_daily_cron.sql` - Cron job scheduler

### Existing Files (Unchanged):
- ✅ `supabase/functions/send-daily-agenda-email/index.ts` - Your working email function
- ✅ `src/components/DailyAgendaEmailSettings.tsx` - Your UI settings page

---

## 🚀 **MANUAL STEPS - RUN THESE IN ORDER**

### **Step 1: Generate and Set Cron Secret** (2 minutes)

This secures the cron trigger so only authorized requests can trigger emails.

```bash
# Navigate to your project directory
cd /Users/timothyfarzalo/Desktop/jg-january-2026

# Generate a secure random secret
# macOS/Linux:
openssl rand -base64 32

# Copy the output (it will look like: x7F9kL2mN8pQ3wR5tY6uI1oP4sA8dG7kJ9)
```

**Now set it in Supabase:**

```bash
# Replace YOUR_SECRET_HERE with the generated secret
supabase secrets set CRON_SECRET=YOUR_SECRET_HERE

# Verify it's set
supabase secrets list
```

**Expected output:**
```
NAME          VALUE
CRON_SECRET   ••••••••••••••••••••
```

✅ **Checkpoint:** You should see CRON_SECRET in the list (value will be hidden)

---

### **Step 2: Run Database Migration for Tracking Table** (1 minute)

This creates the `daily_summary_log` table to track all email sends.

```bash
# Still in project directory: /Users/timothyfarzalo/Desktop/jg-january-2026

# Apply the migration
supabase db push supabase/migrations/20260123_daily_summary_tracking.sql
```

**Expected output:**
```
Applying migration 20260123_daily_summary_tracking.sql...
Migration applied successfully
```

**Verify it worked:**

```bash
# Connect to your database
supabase db remote connect

# Then in the psql prompt, run:
\dt daily_summary_log

# You should see the table listed
# Type \q to exit psql
```

✅ **Checkpoint:** Table `daily_summary_log` exists

---

### **Step 3: Deploy the Cron Trigger Function** (2 minutes)

This deploys the new lightweight function that pg_cron will call.

```bash
# Deploy the cron trigger function
supabase functions deploy daily-agenda-cron-trigger

# Wait for deployment to complete...
```

**Expected output:**
```
Deploying function: daily-agenda-cron-trigger
Function deployed successfully
```

**Verify deployment:**

```bash
# List all functions
supabase functions list
```

**Expected output (you should see):**
```
NAME                          STATUS    DEPLOYED AT
daily-agenda-cron-trigger     deployed  2026-01-23 ...
send-daily-agenda-email       deployed  ...
send-email                    deployed  ...
... (other functions)
```

✅ **Checkpoint:** `daily-agenda-cron-trigger` appears in function list

---

### **Step 4: Set Database Configuration Variables** (3 minutes)

The cron job needs to know your Supabase URL and the cron secret.

**First, get your Supabase project URL:**

```bash
# Get your project URL
supabase status
```

**Look for output like:**
```
API URL: https://abcdefghijklmnop.supabase.co
```

**Copy that URL (without trailing slash).**

**Now connect to your database and set the config:**

```bash
# Connect to database
supabase db remote connect
```

**In the psql prompt, run these commands (REPLACE the placeholders):**

```sql
-- Replace YOUR_PROJECT_URL with your actual Supabase URL
ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT_ID.supabase.co';

-- Replace YOUR_CRON_SECRET with the secret you generated in Step 1
ALTER DATABASE postgres SET app.cron_secret = 'YOUR_CRON_SECRET_HERE';

-- Verify they're set
SHOW app.supabase_url;
SHOW app.cron_secret;
```

**Expected output:**
```
 app.supabase_url 
------------------
 https://yourproject.supabase.co

 app.cron_secret 
-----------------
 your-secret-here
```

**Type `\q` to exit psql**

✅ **Checkpoint:** Both config variables are set

---

### **Step 5: Schedule the Cron Job** (2 minutes)

This is the final step - schedule the automated daily run.

```bash
# Connect to database
supabase db remote connect
```

**In psql, run the cron setup:**

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule the job (7 AM EST = 12 PM UTC)
SELECT cron.schedule(
  'daily-agenda-email-cron',
  '0 12 * * *',
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/daily-agenda-cron-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.cron_secret')
      ),
      body := jsonb_build_object(
        'triggered_by', 'pg_cron',
        'timestamp', now()
      )
    ) as request_id;
  $$
);
```

**Verify the job is scheduled:**

```sql
-- View scheduled job
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'daily-agenda-email-cron';
```

**Expected output:**
```
 jobid |         jobname          | schedule  | active 
-------+--------------------------+-----------+--------
   123 | daily-agenda-email-cron  | 0 12 * * * | t
```

**Type `\q` to exit psql**

✅ **Checkpoint:** Cron job is scheduled and active (active = t)

---

### **Step 6: Test Immediately** (DON'T WAIT FOR 7 AM!) (2 minutes)

Let's test the entire flow right now to make sure it works!

**Option A: Test via UI (Easiest)**

1. Open your application
2. Go to **Settings** → **Daily Agenda Email Settings**
3. Enable at least one user (yourself)
4. Click **"Send Test Email Now"**
5. Select **"Send to all enabled users"**
6. Click the send button

**Expected:** You should receive an email within 1-2 minutes! ✉️

**Option B: Test via Command Line**

```bash
# Get your cron secret (from Step 1)
# Get your project URL (from Step 4)

# Test the trigger function directly
curl -X POST \
  https://YOUR_PROJECT_ID.supabase.co/functions/v1/daily-agenda-cron-trigger \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

**Expected output:**
```json
{
  "success": true,
  "message": "Daily agenda cron completed successfully",
  "sent": 1,
  "failed": 0,
  ...
}
```

✅ **Checkpoint:** Test email received!

---

### **Step 7: Verify Tracking** (1 minute)

Check that the send was logged to the tracking table.

```bash
# Connect to database
supabase db remote connect
```

```sql
-- View recent email sends
SELECT 
  sent_at AT TIME ZONE 'America/New_York' as sent_at_et,
  recipient_count,
  success_count,
  failure_count,
  triggered_by
FROM daily_summary_log
ORDER BY sent_at DESC
LIMIT 5;
```

**Expected output:**
```
      sent_at_et       | recipient_count | success_count | failure_count | triggered_by 
-----------------------+-----------------+---------------+---------------+--------------
 2026-01-23 14:30:00   |               1 |             1 |             0 | manual
```

**Type `\q` to exit**

✅ **Checkpoint:** Your test send is logged!

---

## 🎉 **YOU'RE DONE!**

### **What Happens Now:**

1. ✅ **Tomorrow at 7:00 AM EST**, the cron job will automatically run
2. ✅ It will send daily agenda emails to all enabled users
3. ✅ All sends are logged to `daily_summary_log` table
4. ✅ Your manual send button still works anytime!

---

## 📊 **Monitoring & Verification**

### **Check Cron Job Execution History**

```bash
supabase db remote connect
```

```sql
-- View recent cron runs
SELECT 
  start_time AT TIME ZONE 'America/New_York' as start_time_et,
  end_time AT TIME ZONE 'America/New_York' as end_time_et,
  status,
  return_message
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-agenda-email-cron')
ORDER BY start_time DESC
LIMIT 10;
```

### **Check Email Send Logs**

```sql
-- View all sends with details
SELECT 
  sent_at AT TIME ZONE 'America/New_York' as sent_at_et,
  recipient_count,
  success_count,
  failure_count,
  triggered_by,
  error_details
FROM daily_summary_log
ORDER BY sent_at DESC
LIMIT 20;
```

### **Check Edge Function Logs**

```bash
# View real-time logs
supabase functions logs daily-agenda-cron-trigger --tail

# View historical logs
supabase functions logs daily-agenda-cron-trigger --limit 100

# View send-daily-agenda-email logs
supabase functions logs send-daily-agenda-email --limit 50
```

---

## ⏰ **Adjusting Send Time**

The default is **7:00 AM EST** (12:00 PM UTC). To change:

```bash
# Connect to database
supabase db remote connect
```

```sql
-- Unschedule current job
SELECT cron.unschedule('daily-agenda-email-cron');

-- Schedule with new time
-- Examples:
-- '0 11 * * *' = 6:00 AM EST (11 AM UTC)
-- '0 12 * * *' = 7:00 AM EST (12 PM UTC) - DEFAULT
-- '0 13 * * *' = 8:00 AM EST (1 PM UTC)
-- '0 14 * * *' = 9:00 AM EST (2 PM UTC)
-- '0 12 * * 1-5' = 7 AM EST, weekdays only

SELECT cron.schedule(
  'daily-agenda-email-cron',
  '0 13 * * *',  -- Change this line to your desired time
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/daily-agenda-cron-trigger',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.cron_secret')
      ),
      body := jsonb_build_object(
        'triggered_by', 'pg_cron',
        'timestamp', now()
      )
    ) as request_id;
  $$
);

-- Verify new schedule
SELECT jobid, jobname, schedule FROM cron.job WHERE jobname = 'daily-agenda-email-cron';
```

---

## 🔧 **Troubleshooting**

### **Problem: No email received after test**

**Check:**
1. Is at least one user enabled in Daily Agenda Email Settings?
2. Check function logs: `supabase functions logs daily-agenda-cron-trigger --tail`
3. Check email logs: `SELECT * FROM daily_summary_log ORDER BY sent_at DESC LIMIT 1;`
4. Check your spam folder
5. Verify SendGrid is configured: `supabase secrets list` (should show SENDGRID_API_KEY)

### **Problem: Cron job not running**

**Check:**
```sql
-- Is the job active?
SELECT * FROM cron.job WHERE jobname = 'daily-agenda-email-cron';

-- Check execution attempts
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-agenda-email-cron')
ORDER BY start_time DESC LIMIT 5;
```

### **Problem: Function returns 401 Unauthorized**

**Fix:**
- Make sure CRON_SECRET is set correctly in both places:
  1. Supabase secrets: `supabase secrets list`
  2. Database config: `SHOW app.cron_secret;` (in psql)
- They must match exactly!

### **Problem: Can't find my project URL**

```bash
supabase status
# Look for "API URL: https://xxx.supabase.co"
```

---

## 📞 **Need Help?**

1. **Check function logs**: `supabase functions logs daily-agenda-cron-trigger --tail`
2. **Check database logs**: `SELECT * FROM daily_summary_log ORDER BY sent_at DESC;`
3. **Check cron execution**: `SELECT * FROM cron.job_run_details ...`
4. **Manual test**: Use the "Send Test Email" button in your UI

---

## 🎯 **Quick Reference Commands**

```bash
# Deploy functions
supabase functions deploy daily-agenda-cron-trigger

# View function logs
supabase functions logs daily-agenda-cron-trigger --tail

# Connect to database
supabase db remote connect

# View scheduled cron jobs
# (in psql): SELECT * FROM cron.job;

# View cron execution history
# (in psql): SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

# View email send logs
# (in psql): SELECT * FROM daily_summary_log ORDER BY sent_at DESC LIMIT 10;

# Unschedule cron job (if needed)
# (in psql): SELECT cron.unschedule('daily-agenda-email-cron');
```

---

## ✅ **Success Checklist**

- [ ] CRON_SECRET generated and set
- [ ] `daily_summary_log` table created
- [ ] `daily-agenda-cron-trigger` function deployed
- [ ] Database config variables set (URL and secret)
- [ ] Cron job scheduled and active
- [ ] Test email sent and received
- [ ] Send logged in `daily_summary_log`
- [ ] Tomorrow's send scheduled for 7 AM EST

---

**🎉 CONGRATULATIONS! Your daily agenda emails are now fully automated!**

---

**Date Implemented**: January 23, 2026  
**Next Automatic Send**: Tomorrow at 7:00 AM EST  
**Manual Send**: Always available via UI

---
