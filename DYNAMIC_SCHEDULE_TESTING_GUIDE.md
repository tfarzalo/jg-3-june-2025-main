# Dynamic Email Schedule - Testing Guide

## Overview
This guide covers testing the new dynamic email scheduling feature that allows admins to change the daily agenda email send time from the UI.

## Prerequisites
✅ Migration `20260123_add_email_schedule_config.sql` applied
✅ Admin UI component `DailyAgendaEmailSettings.tsx` updated
✅ Cron job `daily-agenda-email-cron` configured
✅ Edge function `daily-agenda-cron-trigger` deployed

## Testing Steps

### 1. Apply Migration (If Not Already Applied)

```bash
./apply_schedule_migration.sh
```

Or manually:
```bash
cd /Users/timothyfarzalo/Desktop/jg-january-2026
npx supabase db push
```

### 2. Verify Database Setup

Run the verification script:
```bash
psql -f test_schedule_change.sql
```

Expected output:
- ✅ `daily_email_config` table exists with default config
- ✅ `update_daily_email_cron_schedule()` function exists
- ✅ `trigger_update_cron_schedule` trigger exists
- ✅ Cron job `daily-agenda-email-cron` exists

### 3. Test UI Time Picker

1. **Access Admin Settings**
   - Navigate to `/admin` in your app
   - Click on "Daily Agenda Email Settings"

2. **Locate Email Schedule Section**
   - Should be at the top of the page
   - Shows current send time in a time picker
   - Has "Update Time" button

3. **Change the Send Time**
   - Click the time input
   - Select a new time (e.g., 2:00 PM)
   - Click "Update Time"
   - Should see success toast: "Daily email time updated to 14:00. Cron job will be rescheduled automatically."

### 4. Verify Cron Job Updated

After changing time in UI, run:
```sql
-- Check cron job schedule
SELECT 
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname = 'daily-agenda-email-cron';
```

Expected:
- Schedule should match new time (e.g., `0 14 * * *` for 2:00 PM)

### 5. Test Database Trigger

Direct database test:
```sql
-- Update config
UPDATE daily_email_config 
SET send_time_utc = '15:30:00'
WHERE id = (SELECT id FROM daily_email_config LIMIT 1);

-- Check cron updated
SELECT schedule FROM cron.job WHERE jobname = 'daily-agenda-email-cron';
-- Should show: 30 15 * * *
```

### 6. End-to-End Workflow Test

Complete workflow test:

1. **Set time to 5 minutes from now**
   - In UI, set time to current time + 5 minutes
   - Click "Update Time"

2. **Verify in database**
   ```sql
   SELECT send_time_utc FROM daily_email_config;
   ```

3. **Check cron job**
   ```sql
   SELECT schedule FROM cron.job WHERE jobname = 'daily-agenda-email-cron';
   ```

4. **Wait for scheduled time**
   - Monitor `daily_summary_log` table
   - Should see new entry within 1 minute of scheduled time

5. **Check logs**
   ```sql
   SELECT * FROM daily_summary_log 
   ORDER BY sent_at DESC 
   LIMIT 5;
   ```

### 7. Test Edge Cases

**Test 1: Midnight**
- Set time to 00:00
- Verify cron: `0 0 * * *`

**Test 2: Multiple Updates**
- Change time 3 times in succession
- Each should trigger cron reschedule
- Final schedule should match last update

**Test 3: Permission Check**
- Log in as non-admin user
- Should NOT see time picker (or get error if trying to update)

## Troubleshooting

### Issue: Time doesn't update in UI
**Solution:**
- Check browser console for errors
- Verify `daily_email_config` table has RLS policies
- Confirm user is admin

### Issue: Cron job doesn't reschedule
**Solution:**
```sql
-- Check trigger is enabled
SELECT tgenabled FROM pg_trigger 
WHERE tgname = 'trigger_update_cron_schedule';

-- Manually trigger reschedule
SELECT update_daily_email_cron_schedule();
```

### Issue: Emails not sending at new time
**Solution:**
1. Check cron job schedule matches config
2. Verify `cron_config` table has correct URL and secret
3. Test function manually:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/daily-agenda-cron-trigger \
     -H "Content-Type: application/json" \
     -d '{"triggered_by":"manual_test"}'
   ```

## Verification Checklist

- [ ] Migration applied successfully
- [ ] `daily_email_config` table exists
- [ ] Trigger function `update_daily_email_cron_schedule` exists
- [ ] Trigger `trigger_update_cron_schedule` exists
- [ ] UI shows time picker
- [ ] Can change time in UI
- [ ] Success toast appears
- [ ] Cron job schedule updates
- [ ] Emails send at new time
- [ ] Non-admins cannot access time picker

## SQL Queries for Monitoring

### Check current config
```sql
SELECT * FROM daily_email_config;
```

### Check cron schedule
```sql
SELECT jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'daily-agenda-email-cron';
```

### View recent email logs
```sql
SELECT 
  sent_at,
  recipient_email,
  success,
  error_message
FROM daily_summary_log
ORDER BY sent_at DESC
LIMIT 10;
```

### Count enabled users
```sql
SELECT COUNT(*) as enabled_users
FROM daily_email_settings
WHERE enabled = true;
```

## Notes

- Time picker uses 24-hour format
- All times are stored and scheduled in UTC
- UI displays times in user's local timezone
- Cron job automatically reschedules via database trigger
- Changes take effect immediately (next scheduled run)
- Trigger only fires on actual time changes (not on every update)

## Support

If issues persist:
1. Check Supabase logs in dashboard
2. Review Edge Function logs
3. Check `daily_summary_log` for error messages
4. Verify `cron_config` table values
5. Test manual cron trigger: `SELECT cron.schedule(...)`
