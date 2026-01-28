# Daily Agenda Email - Frontend Not Syncing to Cron

## 🔴 Problem

**Frontend admin settings show:** 6:00 AM EST  
**Cron job is actually set to:** Probably 7:00 AM EST (or wrong time)  
**Root cause:** Trigger system not updating cron job when frontend settings change

## 🎯 Quick Fix (2 minutes)

### Step 1: Run Diagnostic
**File:** `DIAGNOSE_FRONTEND_CRON_SYNC.sql`

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste `DIAGNOSE_FRONTEND_CRON_SYNC.sql`
3. Click "Run"
4. Review the diagnosis at the bottom

This will tell you:
- ✅ Which table is storing the config
- ✅ What the cron job is currently set to
- ✅ If the trigger system is working
- ✅ What's causing the disconnect

### Step 2: Apply Quick Fix
**File:** `FIX_CRON_TO_6AM_EST.sql`

1. Open Supabase Dashboard → SQL Editor
2. Copy and paste `FIX_CRON_TO_6AM_EST.sql`
3. Click "Run"
4. Verify the output shows: `✅ CORRECT (6:00 AM EST)`

**This will:**
- ✅ Remove old cron job
- ✅ Create new cron job scheduled for 6:00 AM EST (11:00 UTC)
- ✅ Show you when the next email will be sent

## 📊 Understanding the Issue

### How It Should Work

```
1. Admin changes time in frontend → 6:00 AM EST
2. Frontend updates database table
3. Database trigger fires
4. Trigger function updates cron job
5. Cron job now runs at new time
```

### What's Probably Broken

One of these is likely missing or misconfigured:
- ❌ Database trigger not set up
- ❌ Trigger function doesn't have permissions
- ❌ Cron job created manually (not via trigger)
- ❌ Using different tables (daily_email_config vs app_settings)

## 🔍 Detailed Diagnosis

### Check 1: Which Table Is Used?

The system might use one of two tables:

**Option A: `daily_email_config`** (older approach)
```sql
SELECT * FROM daily_email_config;
```

**Option B: `app_settings`** (newer approach)
```sql
SELECT * FROM app_settings WHERE key = 'daily_agenda_email_schedule';
```

### Check 2: What's the Cron Job Set To?

```sql
SELECT 
  schedule,
  CASE schedule
    WHEN '0 11 * * *' THEN '6:00 AM EST'
    WHEN '0 12 * * *' THEN '7:00 AM EST'
    ELSE 'Unknown: ' || schedule
  END AS actual_time
FROM cron.job
WHERE jobname = 'send-daily-agenda-email';
```

### Check 3: Is the Trigger Working?

```sql
-- Check if trigger function exists
SELECT proname FROM pg_proc 
WHERE proname = 'update_daily_email_cron_schedule';

-- Check if trigger is attached
SELECT tgname FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname = 'daily_email_config';
```

## 🔧 Permanent Fix Options

### Option 1: Fix the Trigger System (Long-term)

If you want the frontend to automatically update the cron job:

1. **Create the trigger function:**

```sql
CREATE OR REPLACE FUNCTION update_daily_email_cron_schedule()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  cron_schedule TEXT;
  hour_utc INTEGER;
BEGIN
  -- Convert send time to UTC for cron
  -- Extract hour from the time
  hour_utc := EXTRACT(HOUR FROM NEW.send_time_utc AT TIME ZONE NEW.send_time_timezone AT TIME ZONE 'UTC');
  
  -- Build cron expression (runs every day at the specified hour)
  cron_schedule := '0 ' || hour_utc || ' * * *';
  
  -- Unschedule old job
  PERFORM cron.unschedule('send-daily-agenda-email');
  
  -- Schedule new job
  PERFORM cron.schedule(
    'send-daily-agenda-email',
    cron_schedule,
    $$
    SELECT net.http_post(
      url := 'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body := '{}'::jsonb
    );
    $$
  );
  
  RETURN NEW;
END;
$$;
```

2. **Attach the trigger:**

```sql
DROP TRIGGER IF EXISTS update_cron_on_config_change ON daily_email_config;

CREATE TRIGGER update_cron_on_config_change
  AFTER UPDATE ON daily_email_config
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_email_cron_schedule();
```

3. **Test it:**

```sql
-- Try updating the config
UPDATE daily_email_config 
SET send_time_utc = '06:00:00',
    send_time_timezone = 'America/New_York',
    updated_at = NOW();

-- Check if cron updated
SELECT schedule FROM cron.job WHERE jobname = 'send-daily-agenda-email';
```

### Option 2: Manual Updates (Quick & Simple)

If triggers are problematic, just manually update the cron job whenever needed:

```sql
-- For 6 AM EST:
SELECT cron.schedule(
  'send-daily-agenda-email',
  '0 11 * * *',  -- 11:00 UTC = 6:00 AM EST
  $$ ... $$
);

-- For 7 AM EST:
SELECT cron.schedule(
  'send-daily-agenda-email',
  '0 12 * * *',  -- 12:00 UTC = 7:00 AM EST
  $$ ... $$
);
```

## ⏰ Timezone Reference

**EST to UTC Conversion:**
| EST Time | UTC Time | Cron Expression |
|----------|----------|-----------------|
| 5:00 AM  | 10:00 AM | `0 10 * * *`    |
| 6:00 AM  | 11:00 AM | `0 11 * * *`    |
| 7:00 AM  | 12:00 PM | `0 12 * * *`    |
| 8:00 AM  | 1:00 PM  | `0 13 * * *`    |

**Note:** During Daylight Saving Time (EDT), subtract 4 hours instead of 5.

## 🧪 Test After Fix

1. **Check cron job:**
```sql
SELECT schedule FROM cron.job WHERE jobname = 'send-daily-agenda-email';
-- Should show: 0 11 * * * (for 6 AM EST)
```

2. **Check next send time:**
Run `QUICK_CHECK_NEXT_EMAIL.sql` to see when the next email will be sent.

3. **Send test email:**
- Go to Dashboard → Settings → Daily Agenda Email
- Click "Send Test Email"
- Check your inbox

## 📝 Frontend Fix (Optional)

If you want the frontend to display the correct time after manually fixing the cron:

```sql
-- Update the database to match what you set in cron
UPDATE daily_email_config
SET 
  send_time_utc = '06:00:00',
  send_time_timezone = 'America/New_York',
  updated_at = NOW()
WHERE id = (SELECT id FROM daily_email_config LIMIT 1);
```

Or if using app_settings:

```sql
INSERT INTO app_settings (key, value, description)
VALUES (
  'daily_agenda_email_schedule',
  '{"hour": "6", "timezone": "America/New_York"}',
  'Daily agenda email schedule configuration'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;
```

## 🎯 Recommended Approach

**For now (quick fix):**
1. ✅ Run `FIX_CRON_TO_6AM_EST.sql` to set cron to 6 AM EST immediately
2. ✅ Update frontend config to match (optional)

**For later (permanent fix):**
1. Investigate why trigger isn't working
2. Fix trigger permissions
3. Test that frontend updates actually change cron

## 📚 Related Files

- `DIAGNOSE_FRONTEND_CRON_SYNC.sql` - Diagnostic script
- `FIX_CRON_TO_6AM_EST.sql` - Quick fix for 6 AM EST
- `QUICK_CHECK_NEXT_EMAIL.sql` - Check when next email sends
- `DAILY_AGENDA_QUICK_DIAGNOSTIC.md` - General diagnostic guide

## ✅ Summary

**Problem:** Frontend shows 6 AM EST, but cron isn't syncing  
**Quick Fix:** Run `FIX_CRON_TO_6AM_EST.sql`  
**Long-term:** Fix the trigger system or manually update cron when needed  
**Verification:** Run `QUICK_CHECK_NEXT_EMAIL.sql` to confirm

---

**Created:** January 27, 2026  
**Issue:** Frontend/Cron sync problem  
**Status:** Quick fix available, permanent fix needs investigation
