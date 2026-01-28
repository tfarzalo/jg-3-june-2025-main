# ⚡ QUICK START - Daily Agenda Email Automation

## 🚀 **7 Steps to Launch** (15 minutes total)

### 1️⃣ **Generate & Set Secret** (2 min)
```bash
cd /Users/timothyfarzalo/Desktop/jg-january-2026
openssl rand -base64 32
# Copy the output, then:
supabase secrets set CRON_SECRET=<paste-secret-here>
```

### 2️⃣ **Create Tracking Table** (1 min)
```bash
supabase db push supabase/migrations/20260123_daily_summary_tracking.sql
```

### 3️⃣ **Deploy Trigger Function** (2 min)
```bash
supabase functions deploy daily-agenda-cron-trigger
```

### 4️⃣ **Set Database Config** (3 min)
```bash
supabase db remote connect
```
Then in psql:
```sql
ALTER DATABASE postgres SET app.supabase_url = 'https://YOUR_PROJECT.supabase.co';
ALTER DATABASE postgres SET app.cron_secret = 'YOUR_SECRET_FROM_STEP_1';
\q
```

### 5️⃣ **Schedule Cron Job** (2 min)
```bash
supabase db remote connect
```
Then in psql:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

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

SELECT * FROM cron.job WHERE jobname = 'daily-agenda-email-cron';
\q
```

### 6️⃣ **Test NOW** (2 min)
Open your app → Settings → Daily Agenda Email Settings → Enable yourself → Send Test Email

### 7️⃣ **Verify** (1 min)
```bash
supabase db remote connect
```
```sql
SELECT * FROM daily_summary_log ORDER BY sent_at DESC LIMIT 1;
\q
```

---

## ✅ **You're Done!**

**Emails will automatically send at 7:00 AM EST every day.**

---

## 📊 **Monitor**

```bash
# View function logs
supabase functions logs daily-agenda-cron-trigger --tail

# View cron history (in psql)
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-agenda-email-cron')
ORDER BY start_time DESC LIMIT 5;

# View email sends (in psql)
SELECT * FROM daily_summary_log ORDER BY sent_at DESC LIMIT 10;
```

---

## ⏰ **Change Send Time**

```sql
-- In psql:
SELECT cron.unschedule('daily-agenda-email-cron');

-- Then schedule with new time:
-- '0 11 * * *' = 6 AM EST
-- '0 12 * * *' = 7 AM EST (default)
-- '0 13 * * *' = 8 AM EST
-- '0 14 * * *' = 9 AM EST
```

---

## 🆘 **Troubleshooting**

**No email?**
- Check enabled users: Settings → Daily Agenda Email Settings
- Check logs: `supabase functions logs daily-agenda-cron-trigger --tail`
- Check: `SELECT * FROM daily_summary_log ORDER BY sent_at DESC LIMIT 1;`

**401 Unauthorized?**
- Verify: `supabase secrets list` (should show CRON_SECRET)
- Verify: `SHOW app.cron_secret;` (in psql)
- They must match!

**Cron not running?**
- Check: `SELECT * FROM cron.job WHERE jobname = 'daily-agenda-email-cron';`
- Should show: active = t

---

## 📁 **Files Created**

✅ `supabase/migrations/20260123_daily_summary_tracking.sql`  
✅ `supabase/functions/daily-agenda-cron-trigger/index.ts`  
✅ `supabase/migrations/20260123_setup_daily_cron.sql`  
✅ `DAILY_AGENDA_AUTOMATION_SETUP_GUIDE.md` (full guide)

---

**🎉 That's it! Fully automated daily emails starting tomorrow at 7 AM EST!**
