# How to Verify Cron Job Schedule (Without Direct SQL Access)

## The Issue
The `cron` schema requires elevated permissions (postgres/superuser role) to query directly. Regular authenticated users get "permission denied for schema cron" error.

## ✅ Solutions

### Option 1: Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Open your project: https://supabase.com/dashboard/project/[your-project]

2. **Navigate to Database**
   - Click **Database** in left sidebar
   - Click **Extensions**

3. **Find pg_cron**
   - Scroll to find `pg_cron` extension
   - Click on it to view cron jobs

4. **View Jobs**
   - Look for job: `daily-agenda-email-cron`
   - Check the **schedule** column
   - Should match your `daily_email_config.send_time_utc`

### Option 2: SQL Editor with Postgres Role

If you have access to run queries as the `postgres` user:

```sql
-- Switch to postgres role (if available in your setup)
SET ROLE postgres;

-- View cron jobs
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active,
  database
FROM cron.job 
WHERE jobname = 'daily-agenda-email-cron';

-- Reset role
RESET ROLE;
```

### Option 3: Check Function Execution Logs

Even without direct cron access, you can verify the trigger works by checking if the function exists and testing it:

```sql
-- 1. Verify function exists
SELECT 
  proname as function_name,
  prosrc as function_code
FROM pg_proc 
WHERE proname = 'update_daily_email_cron_schedule';

-- 2. Test by updating config (trigger will fire)
UPDATE daily_email_config 
SET send_time_utc = '14:00:00'
WHERE id = (SELECT id FROM daily_email_config LIMIT 1);

-- 3. Check update was saved
SELECT send_time_utc, updated_at FROM daily_email_config;

-- 4. Change back to original time
UPDATE daily_email_config 
SET send_time_utc = '12:00:00'
WHERE id = (SELECT id FROM daily_email_config LIMIT 1);
```

### Option 4: Monitor Email Logs

The ultimate verification - check if emails actually send at the scheduled time:

```sql
-- View recent email sends
SELECT 
  sent_at,
  recipient_email,
  success,
  error_message,
  'Email send log' as check_type
FROM daily_summary_log
ORDER BY sent_at DESC
LIMIT 10;

-- Check if emails are sending at expected time
SELECT 
  DATE_TRUNC('hour', sent_at) as send_hour,
  COUNT(*) as email_count,
  'Emails grouped by hour' as check_type
FROM daily_summary_log
WHERE sent_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', sent_at)
ORDER BY send_hour DESC;
```

## 🎯 Best Practice: Test via UI

The easiest way to verify everything works:

1. **Access Admin Settings**
   - Navigate to `/admin` → "Daily Agenda Email Settings"

2. **Change Send Time**
   - Use the time picker to select a new time
   - Click "Update Time"
   - Should see success toast

3. **Verify in Database**
   ```sql
   SELECT send_time_utc, updated_at FROM daily_email_config;
   ```

4. **Wait for Next Send**
   - Wait until the scheduled time
   - Check `daily_summary_log` for new entries
   - Verify emails were sent at correct time

5. **Confirm in Supabase Dashboard**
   - Check pg_cron extension as described above
   - Verify schedule matches your setting

## 📊 Complete Verification Checklist

Run these queries to verify the setup (without needing cron access):

```sql
-- ✓ Config table exists and has data
SELECT * FROM daily_email_config;

-- ✓ Trigger function exists
SELECT proname FROM pg_proc WHERE proname = 'update_daily_email_cron_schedule';

-- ✓ Trigger exists and is enabled
SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'trigger_update_cron_schedule';

-- ✓ RLS policies exist
SELECT policyname FROM pg_policies WHERE tablename = 'daily_email_config';

-- ✓ Recent email activity (if any)
SELECT * FROM daily_summary_log ORDER BY sent_at DESC LIMIT 5;
```

All of these should return results. If they do, your setup is complete! 🎉

## 🚨 Troubleshooting

### "Permission denied for schema cron"
**This is normal!** Regular users can't query the cron schema directly. Use the Supabase Dashboard instead.

### "Trigger not firing"
1. Verify trigger exists: `SELECT tgenabled FROM pg_trigger WHERE tgname = 'trigger_update_cron_schedule';`
2. Check it's enabled (should be 'O' for origin enabled)
3. Test by updating config: `UPDATE daily_email_config SET send_time_utc = '13:00:00';`

### "Emails not sending at new time"
1. Check Supabase Dashboard → Database → Extensions → pg_cron
2. Verify job schedule matches config
3. Check Edge Function logs for errors
4. Verify `cron_config` table has correct URL and secret

## 📝 Summary

**You don't need direct cron access!** The system is designed to work automatically:

1. ✅ Config table created
2. ✅ Trigger function created
3. ✅ Trigger enabled
4. ✅ RLS policies in place
5. ✅ UI will update config
6. ✅ Trigger will reschedule cron
7. ✅ Emails will send at new time

**Just test it in the UI and verify emails send at the right time!** 🚀
