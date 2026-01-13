# Daily Agenda Email - Quick Reference Card

## 📅 Schedule
**7:00 AM ET / 4:00 AM PT** (Every Day)  
Cron: `0 12 * * *` (12:00 UTC)

---

## 🔍 Quick Status Check
```sql
-- Is it running?
SELECT jobid, schedule, active 
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job';

-- Recent runs
SELECT status, return_message, start_time 
FROM cron.job_run_details 
WHERE jobid = 3 
ORDER BY start_time DESC LIMIT 5;

-- Who's getting emails?
SELECT p.email, des.enabled 
FROM daily_email_settings des
JOIN profiles p ON p.id = des.user_id
WHERE des.enabled = true;
```

---

## 🎛️ Common Actions

### Pause Emails
```sql
UPDATE cron.job SET active = false 
WHERE jobname = 'daily-agenda-email-job';
```

### Resume Emails
```sql
UPDATE cron.job SET active = true 
WHERE jobname = 'daily-agenda-email-job';
```

### Send Test Email Now
```sql
SELECT status, content::json->>'message' as result
FROM http((
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

### Change Schedule
```sql
-- Unschedule
SELECT cron.unschedule('daily-agenda-email-job');

-- Reschedule (example: 8 AM ET = 13:00 UTC)
SELECT cron.schedule(
  'daily-agenda-email-job',
  '0 13 * * *',
  $$ [full command from FIX_DAILY_AGENDA_CRON_JOB.sql] $$
);
```

---

## ⏰ Common Schedules

| Time (ET) | Time (PT) | Cron Expression | Use Case |
|-----------|-----------|----------------|----------|
| 7:00 AM | 4:00 AM | `0 12 * * *` | Current (early start) |
| 8:00 AM | 5:00 AM | `0 13 * * *` | Standard morning |
| 9:00 AM | 6:00 AM | `0 14 * * *` | Late morning |
| 7:00 AM (M-F) | 4:00 AM (M-F) | `0 12 * * 1-5` | Weekdays only |

---

## 🚨 Troubleshooting

| Symptom | Quick Fix |
|---------|-----------|
| No emails sent | Check: `SELECT COUNT(*) FROM daily_email_settings WHERE enabled = true;` |
| Job shows "failed" | Check: `SELECT return_message FROM cron.job_run_details WHERE jobid = 3 ORDER BY start_time DESC LIMIT 1;` |
| Wrong time | Verify schedule: `SELECT schedule FROM cron.job WHERE jobname = 'daily-agenda-email-job';` |
| HTML error response | Edge Function issue - check Supabase logs |

---

## 📞 Admin UI
**Settings → Daily Agenda Email**
- Toggle users on/off to control who receives emails
- Changes take effect at next scheduled run

---

## 📊 Health Check (Run Daily)
```sql
SELECT 
  'Cron Job' as component,
  CASE WHEN active THEN '✅ Active' ELSE '❌ Inactive' END as status
FROM cron.job 
WHERE jobname = 'daily-agenda-email-job'

UNION ALL

SELECT 
  'Recipients' as component,
  CASE WHEN COUNT(*) > 0 THEN '✅ ' || COUNT(*) || ' enabled' ELSE '⚠️ None enabled' END as status
FROM daily_email_settings 
WHERE enabled = true

UNION ALL

SELECT 
  'Last Run' as component,
  CASE 
    WHEN status = 'succeeded' THEN '✅ Success at ' || start_time::text
    WHEN status = 'failed' THEN '❌ Failed: ' || return_message
    ELSE '⚠️ ' || status
  END as status
FROM cron.job_run_details 
WHERE jobid = 3 
ORDER BY start_time DESC 
LIMIT 1;
```

---

**Job ID:** 3  
**Deployed:** Dec 11, 2025  
**Status:** 🟢 Active
