# Daily Agenda Email - Monitoring & Verification Guide

## ✅ Current Status (Nov 24, 2024)

The daily agenda email system is **FULLY DEPLOYED** and running via Supabase pg_cron.

### Active Configuration
- **Schedule**: 5:00 AM ET on weekdays (Mon-Fri)
- **Cron Expression**: `0 9 * * 1-5` (UTC)
- **Job ID**: 1 (active and enabled)
- **Automation**: Supabase pg_cron (not GitHub Actions)

---

## 📊 Monitoring the pg_cron Job

### 1. Check Job Run History

Run this SQL query in Supabase SQL Editor to see execution history:

```sql
SELECT 
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = 1
ORDER BY start_time DESC
LIMIT 20;
```

**What to look for:**
- `status`: Should be `succeeded` (not `failed`)
- `return_message`: Should be empty or show HTTP 200 response
- `start_time`: Should match 9:00 AM UTC (5:00 AM ET) on weekdays

### 2. Check Edge Function Logs

1. Go to Supabase Dashboard → Edge Functions
2. Click on `send-daily-agenda-email`
3. Click "Logs" tab
4. Filter by date/time around 5:00 AM ET

**What to look for:**
- Successful POST requests from pg_cron
- Status 200 responses
- No error messages
- Job data being fetched and processed

### 3. Verify Email Delivery

**Check these locations:**
- Inbox of recipients configured in admin settings
- Spam/junk folders (especially for first email)
- Email server logs (if you have access)

**Email details:**
- From: noreply@jgpaintingpros.com
- Subject: "Daily Job Summary for [Date]"
- Format: HTML table with work order numbers, names, addresses, etc.

---

## 🔍 Troubleshooting

### If No Emails Are Sent

1. **Verify cron job is running:**
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'daily_agenda_email';
   ```
   - Ensure `active = true`

2. **Check for errors in job history:**
   ```sql
   SELECT * FROM cron.job_run_details 
   WHERE jobid = 1 AND status = 'failed' 
   ORDER BY start_time DESC;
   ```

3. **Test Edge Function manually:**
   ```bash
   curl -i --location --request POST 'https://your-project.supabase.co/functions/v1/send-daily-agenda-email' \
     --header 'Authorization: Bearer YOUR_ANON_KEY' \
     --header 'Content-Type: application/json' \
     --data '{"scheduled": true}'
   ```

4. **Check admin settings:**
   - Go to Admin → Daily Agenda Email Settings
   - Ensure email is enabled
   - Verify recipient list is correct
   - Confirm settings are saved

### If Emails Are Sent but Empty

1. **Check job data query in Edge Function**
2. **Verify jobs exist for the date range:**
   ```sql
   SELECT * FROM jobs 
   WHERE DATE(job_date) = CURRENT_DATE 
   AND status NOT IN ('cancelled', 'completed');
   ```

3. **Test email settings in admin UI:**
   - Use "Send Test Email" button
   - Verify job data appears in test email

### If Emails Arrive at Wrong Time

1. **Verify cron expression:**
   ```sql
   SELECT schedule FROM cron.job WHERE jobname = 'daily_agenda_email';
   ```
   Should be: `0 9 * * 1-5` (9 AM UTC = 5 AM ET)

2. **Check server timezone:**
   - Supabase pg_cron uses UTC
   - Your schedule should account for ET offset

---

## 📋 Quick Reference

### Manual Test (Anytime)
```bash
# Test the Edge Function directly
curl -X POST https://your-project.supabase.co/functions/v1/send-daily-agenda-email \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"scheduled": true}'
```

### Disable Daily Email
```sql
-- Temporarily disable
SELECT cron.unschedule('daily_agenda_email');

-- Re-enable
SELECT cron.schedule(
  'daily_agenda_email',
  '0 9 * * 1-5',
  $$SELECT net.http_post(...)$$
);
```

### Update Email Recipients
1. Go to Admin → Daily Agenda Email Settings
2. Modify recipient list
3. Click "Save Settings"
4. Send test email to verify

---

## 📅 Next Steps

### Short Term (This Week)
1. ✅ Wait for Monday morning (5:00 AM ET) to confirm first automated email
2. ⏳ Check cron job history after Monday's run
3. ⏳ Verify email delivery to all recipients
4. ⏳ Confirm job data is accurate and complete

### Medium Term (This Month)
1. Monitor daily for first week
2. Check for any error patterns
3. Remove deprecated GitHub Actions workflow if pg_cron works perfectly
4. Clean up unused SQL setup files

### Long Term
1. Add email delivery metrics/dashboard
2. Consider adding email open/click tracking
3. Add option for custom email templates
4. Add support for multiple time zones

---

## 📝 Important Files

### Core Implementation
- `supabase/functions/send-daily-agenda-email/index.ts` - Edge Function
- `supabase/migrations/20251124000001_daily_email_cron_job.sql` - Cron setup
- `src/components/DailyAgendaEmailSettings.tsx` - Admin UI

### Documentation
- `DAILY_AGENDA_EMAIL_IMPLEMENTATION.md` - Full implementation guide
- `DAILY_EMAIL_SCHEDULE_UPDATE_5AM_WEEKDAYS.md` - Schedule details
- `DAILY_EMAIL_ISSUE_RESOLVED.md` - Troubleshooting history
- This file - Monitoring guide

### SQL Queries
- `check_cron_history.sql` - Check job run history
- `SUPABASE_CRON_SETUP.sql` - Setup reference
- `SIMPLE_SUPABASE_CRON_SETUP.sql` - Simplified setup

---

## ✅ Success Criteria

Your daily agenda email system is working correctly when:

1. ✅ Cron job shows `active = true` in database
2. ⏳ Emails arrive at 5:00 AM ET on weekdays (Mon-Fri)
3. ⏳ Email contains accurate job data for the day
4. ⏳ All configured recipients receive the email
5. ⏳ No errors in cron job history or Edge Function logs
6. ⏳ Work order numbers formatted correctly (WO-XXXXXX)
7. ⏳ Email footer shows "JG Painting Pros Inc. Portal"

---

## 🆘 Need Help?

If you encounter issues:

1. Check this guide's troubleshooting section
2. Review Edge Function logs in Supabase
3. Check cron job history with the SQL query above
4. Test the Edge Function manually with curl
5. Verify admin settings are correct

**Note**: The first email will be sent on the next weekday at 5:00 AM ET. If today is a weekday and it's before 5:00 AM, the email will be sent this morning. Otherwise, it will be sent tomorrow (if tomorrow is a weekday).

---

*Last Updated: November 24, 2024*
