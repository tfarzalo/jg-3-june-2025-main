# 📧 Daily Agenda Email Automation

**Status:** ✅ **READY FOR DEPLOYMENT**

This system automatically sends daily agenda emails at 7:00 AM EST without any manual intervention.

---

## 🚀 Quick Start (Choose One)

### Option 1: Guided Interactive Setup (Recommended)
```bash
./setup-daily-agenda-automation.sh
```
**Time:** ~15 minutes | **Difficulty:** Easy | **Best for:** First-time setup

### Option 2: Quick Manual Setup
```bash
cat QUICK_START_DAILY_AGENDA.md
# Then follow the 7 steps
```
**Time:** ~10 minutes | **Difficulty:** Medium | **Best for:** Experienced developers

### Option 3: Detailed Manual Setup
```bash
cat DAILY_AGENDA_AUTOMATION_SETUP_GUIDE.md
# Then follow comprehensive guide
```
**Time:** ~20 minutes | **Difficulty:** Easy | **Best for:** Those who want full understanding

---

## 📚 Documentation

| File | Purpose | When to Use |
|------|---------|-------------|
| **DAILY_AGENDA_AUTOMATION_SUMMARY.md** | Executive overview | Start here for high-level understanding |
| **QUICK_START_DAILY_AGENDA.md** | 7-step setup guide | Quick setup for experienced users |
| **DAILY_AGENDA_AUTOMATION_SETUP_GUIDE.md** | Comprehensive guide | Detailed instructions with troubleshooting |
| **DAILY_AGENDA_QUICK_REF.txt** | Quick reference | Common commands and monitoring |
| **DEPLOYMENT_CHECKLIST_DAILY_AGENDA.txt** | Deployment checklist | Verify deployment steps |

---

## 🛠️ Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| **setup-daily-agenda-automation.sh** | Interactive setup | `./setup-daily-agenda-automation.sh` |
| **verify-daily-agenda-setup.sh** | Post-deployment verification | `./verify-daily-agenda-setup.sh` |

---

## 📁 Implementation Files

### Database Migrations
- `supabase/migrations/20260123_daily_summary_tracking.sql` - Email tracking table
- `supabase/migrations/20260123_setup_daily_cron.sql` - Cron job scheduler

### Edge Functions
- `supabase/functions/daily-agenda-cron-trigger/index.ts` - Cron trigger (NEW)
- `supabase/functions/send-daily-agenda-email/index.ts` - Email sender (EXISTING)

### UI Components
- `src/components/DailyAgendaEmailSettings.tsx` - Settings page (UNCHANGED)

---

## ⚡ What This System Does

1. **Triggers automatically** at 7:00 AM EST every day via pg_cron
2. **Validates authorization** using CRON_SECRET for security
3. **Calls existing email function** (your working code, unchanged)
4. **Sends emails** to all enabled users via Resend
5. **Logs everything** to daily_summary_log table for monitoring
6. **Requires zero manual intervention** once deployed

---

## 🎯 Quick Commands

### Deploy
```bash
./setup-daily-agenda-automation.sh
```

### Verify
```bash
./verify-daily-agenda-setup.sh
```

### Monitor
```bash
# View logs
supabase functions logs daily-agenda-cron-trigger --tail

# Check recent sends (in psql)
SELECT * FROM daily_summary_log ORDER BY sent_at DESC LIMIT 10;

# Check cron status (in psql)
SELECT * FROM cron.job WHERE jobname = 'daily-agenda-email-cron';
```

### Test
```bash
# Via UI
# App → Settings → Daily Agenda Email Settings → Send Test Email

# Via API
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/daily-agenda-cron-trigger \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

---

## 📊 System Architecture

```
Daily Schedule (7:00 AM EST)
           ↓
    [pg_cron trigger]
           ↓
    [daily-agenda-cron-trigger] ← Validates CRON_SECRET
           ↓
    [send-daily-agenda-email]   ← Your existing email logic
           ↓
    [Resend API]                ← Sends emails
           ↓
    [daily_summary_log]         ← Logs results
```

---

## ⚙️ Configuration

| Setting | Value | How to Change |
|---------|-------|---------------|
| **Send Time** | 7:00 AM EST | Edit cron expression in migration |
| **Frequency** | Daily | Edit cron expression in migration |
| **Authorization** | CRON_SECRET | `supabase secrets set CRON_SECRET=...` |
| **Email Service** | Resend | Already configured |

---

## 🔒 Security

- ✅ CRON_SECRET protects trigger endpoint
- ✅ Only pg_cron can trigger (via database)
- ✅ Authorization header validated on every request
- ✅ No secrets in code or Git
- ✅ All secrets in Supabase secrets manager

---

## 📈 Monitoring

### Daily Checks
```sql
-- Check if emails sent today
SELECT * FROM daily_summary_log 
WHERE sent_at > CURRENT_DATE 
ORDER BY sent_at DESC;
```

### Weekly Reviews
```bash
# View function logs
supabase functions logs daily-agenda-cron-trigger --limit 100

# Check cron execution history
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-agenda-email-cron')
ORDER BY start_time DESC LIMIT 20;
```

---

## 🐛 Troubleshooting

### Emails not sending?
1. Check cron is scheduled: `SELECT * FROM cron.job WHERE jobname = 'daily-agenda-email-cron';`
2. Check execution history: `SELECT * FROM cron.job_run_details ...`
3. Check function logs: `supabase functions logs daily-agenda-cron-trigger --tail`

### Function errors?
- Verify CRON_SECRET: `supabase secrets list`
- Check database config: `SHOW app.cron_secret;`

### Need to pause?
```sql
SELECT cron.unschedule('daily-agenda-email-cron');
```

### Need to resume?
```bash
supabase db push supabase/migrations/20260123_setup_daily_cron.sql
```

For detailed troubleshooting, see `DAILY_AGENDA_AUTOMATION_SETUP_GUIDE.md`.

---

## 📞 Support

- **Setup issues:** See `DAILY_AGENDA_AUTOMATION_SETUP_GUIDE.md`
- **Quick reference:** See `DAILY_AGENDA_QUICK_REF.txt`
- **Deployment checklist:** See `DEPLOYMENT_CHECKLIST_DAILY_AGENDA.txt`
- **Overview:** See `DAILY_AGENDA_AUTOMATION_SUMMARY.md`

---

## ✅ Deployment Checklist

After running setup:

- [ ] CRON_SECRET is set (`supabase secrets list`)
- [ ] daily_summary_log table exists
- [ ] daily-agenda-cron-trigger function deployed
- [ ] Database config set (app.supabase_url, app.cron_secret)
- [ ] Cron job scheduled
- [ ] Test email sends successfully
- [ ] Entry appears in daily_summary_log
- [ ] Manual UI sends still work

**Verify everything:** `./verify-daily-agenda-setup.sh`

---

## 🎉 Success!

Once deployed:
- ✅ Emails send automatically at 7:00 AM EST daily
- ✅ No manual intervention required
- ✅ Full monitoring and logging
- ✅ UI/manual sends still work as before
- ✅ ~12 hours/year saved

---

## 📅 Next Steps

1. Run setup: `./setup-daily-agenda-automation.sh`
2. Verify: `./verify-daily-agenda-setup.sh`
3. Test: Send a test email via UI
4. Monitor: Check logs and tracking table
5. Relax: System handles daily sends automatically!

---

**Ready to deploy?** Run `./setup-daily-agenda-automation.sh` now!
