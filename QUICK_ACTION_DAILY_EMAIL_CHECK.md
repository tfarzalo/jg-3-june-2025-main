# QUICK ACTION: Check & Fix Daily Agenda Email

## 🔍 STEP 1: Check if Cron Ran Today
**Go to**: Supabase Dashboard → SQL Editor  
**Run**: `CHECK_CRON_STATUS_AND_HISTORY.sql`

**Look for**:
- ✅ Job exists with `active = true`
- ✅ Recent runs in history (today's date)
- ✅ Status = 'succeeded'
- ❌ If no runs today → proceed to Step 2

---

## 🔧 STEP 2: Update Cron Schedule to 5:00 AM ET
**Go to**: Supabase Dashboard → SQL Editor  
**Run**: `UPDATE_CRON_TO_5AM_ET.sql`

This will:
- Remove old cron job
- Create new job at 5:00 AM ET (10:00 UTC)
- Verify schedule is correct

---

## ✅ STEP 3: Test Immediately
**Option A** - Via Admin UI (Easiest):
1. Go to Admin → Settings → Daily Agenda Email
2. Select "Send to single test email"
3. Enter your email
4. Click "Send Test Email Now"

**Option B** - Via SQL:
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

---

## 📊 STEP 4: Check Edge Function Logs
**Go to**: https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh/functions/send-daily-agenda-email/logs

**Look for**:
- Recent function calls
- HTTP 200 status
- Error messages (if any)

---

## ✅ UI Updates (Already Done)
Updated `DailyAgendaEmailSettings.tsx`:
- Removed time-specific text from header
- "How it works" section now clearly states: **"Emails are sent automatically at 5:00 AM ET every day"**

---

## 📅 Verify Tomorrow
- **Next scheduled run**: 5:00 AM ET tomorrow
- **Check at**: 5:15 AM ET
- **Verify**: Email received in inbox

---

## 🆘 If Still No Emails

1. **Check Recipients**:
   ```sql
   SELECT p.full_name, p.email, des.enabled
   FROM profiles p
   LEFT JOIN daily_email_settings des ON des.user_id = p.id
   WHERE p.role IN ('admin', 'manager') AND des.enabled = true;
   ```

2. **Enable yourself**:
   - Go to Admin → Settings → Daily Agenda Email
   - Toggle ON for your user

3. **Check for jobs today**:
   ```sql
   SELECT COUNT(*) FROM jobs 
   WHERE scheduled_date::date = CURRENT_DATE 
   AND status != 'Cancelled';
   ```

---

## 📁 Files Created
- ✅ `CHECK_CRON_STATUS_AND_HISTORY.sql` - Diagnostic
- ✅ `UPDATE_CRON_TO_5AM_ET.sql` - Fix schedule
- ✅ `DAILY_AGENDA_CRON_INVESTIGATION_DEC_11.md` - Full guide
- ✅ Updated `src/components/DailyAgendaEmailSettings.tsx` - UI text

---

**Status**: Ready to test ✅  
**Next**: Run Step 1 to check current status
