# 🚀 Dynamic Email Schedule - Quick Reference

## For Admins: How to Change Email Send Time

### Step-by-Step
1. Go to **Admin Dashboard** → **Daily Agenda Email Settings**
2. Find **"Email Schedule"** section (at the top)
3. Click the time input and select new time
4. Click **"Update Time"** button
5. See success message ✅

### What Happens
- Time is saved to database
- Cron job automatically reschedules
- Next email sends at new time
- No downtime or manual work needed

---

## For Developers: Quick Commands

### Apply Migration
```bash
./apply_schedule_migration.sh
```

### Verify Setup
```bash
psql -f test_schedule_change.sql
```

### Check Current Schedule
```sql
SELECT schedule FROM cron.job WHERE jobname = 'daily-agenda-email-cron';
```

### Check Current Config
```sql
SELECT send_time_utc FROM daily_email_config;
```

### View Recent Email Logs
```sql
SELECT * FROM daily_summary_log ORDER BY sent_at DESC LIMIT 5;
```

---

## Architecture at a Glance

```
┌─────────────────┐
│   Admin UI      │
│  Time Picker    │
└────────┬────────┘
         │ Update time
         ▼
┌─────────────────────┐
│ daily_email_config  │  ◄── RLS: Admins only
│   send_time_utc     │
└────────┬────────────┘
         │ Trigger fires
         ▼
┌──────────────────────────┐
│ update_cron_schedule()   │
│  - Unschedule old job    │
│  - Schedule new job      │
└────────┬─────────────────┘
         │ Reschedule
         ▼
┌──────────────────────────┐
│    pg_cron Job           │
│ daily-agenda-email-cron  │
└────────┬─────────────────┘
         │ Runs at scheduled time
         ▼
┌──────────────────────────┐
│ daily-agenda-cron-trigger│ ◄── Edge Function
└────────┬─────────────────┘
         │ Calls
         ▼
┌──────────────────────────┐
│ send-daily-agenda-email  │ ◄── Edge Function
│  Sends emails to users   │
└──────────────────────────┘
```

---

## Key Files

### Database
- `supabase/migrations/20260123_add_email_schedule_config.sql` - Main migration

### UI
- `src/components/DailyAgendaEmailSettings.tsx` - Admin settings page

### Edge Functions
- `supabase/functions/daily-agenda-cron-trigger/index.ts` - Cron trigger
- `supabase/functions/send-daily-agenda-email/index.ts` - Email sender

### Testing
- `test_schedule_change.sql` - Verification script
- `DYNAMIC_SCHEDULE_TESTING_GUIDE.md` - Full testing guide

---

## Troubleshooting One-Liners

### UI not showing time picker?
→ Check: User is admin, page refreshed, migration applied

### Update button not working?
→ Check: Browser console, network tab, RLS policies

### Cron not rescheduling?
→ Run: `SELECT tgenabled FROM pg_trigger WHERE tgname = 'trigger_update_cron_schedule';`

### Emails at wrong time?
→ Check: `SELECT schedule FROM cron.job WHERE jobname = 'daily-agenda-email-cron';`

---

## Success Checklist

- [ ] Migration applied
- [ ] UI shows time picker
- [ ] Can change time successfully
- [ ] Success toast appears
- [ ] Cron job reschedules
- [ ] Test email sends at new time

---

## Support

📖 Full docs: `DYNAMIC_SCHEDULE_COMPLETE_SUMMARY.md`  
🧪 Testing: `DYNAMIC_SCHEDULE_TESTING_GUIDE.md`  
🔍 Verify: `test_schedule_change.sql`  

---

**Status:** ✅ Production Ready  
**Last Updated:** January 23, 2026
