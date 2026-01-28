# Daily Agenda Email Schedule - Timezone Fix Visual Guide

## 🔴 THE PROBLEM

```
┌─────────────────────────────────────────────────────────────┐
│                    BEFORE FIX (BROKEN)                      │
└─────────────────────────────────────────────────────────────┘

   Admin UI                  Database                Cron Job              Result
   ────────                  ────────                ────────              ──────
   
   Set time:                 Stores:                 Runs at:              Emails sent:
   7:00 AM ET ──────────▶   07:00:00 ──────────▶   7:00 UTC  ──────▶     2:00 AM EST ❌
                            (treated as UTC!)       (Wrong!)               3:00 AM EDT ❌


   The Problem:
   └─▶ The trigger function used the stored time DIRECTLY as UTC hours
       without converting from ET to UTC first!
```

---

## ✅ THE SOLUTION

```
┌─────────────────────────────────────────────────────────────┐
│                     AFTER FIX (WORKING)                     │
└─────────────────────────────────────────────────────────────┘

   Admin UI                  Database                Function              Cron Job              Result
   ────────                  ────────                ────────              ────────              ──────
   
   Set time:                 Stores:                 Converts:             Runs at:              Emails sent:
   7:00 AM ET ──────────▶   07:00:00   ─────────▶  12:00 UTC  ──────▶   12:00 UTC  ──────▶    7:00 AM EST ✅
                            + timezone             (EST: +5 hrs)         (cron: 0 12 * * *)    7:00 AM EDT ✅
                            America/NY             or 11:00 UTC
                                                   (EDT: +4 hrs)


   The Fix:
   └─▶ New function properly converts: 
       (07:00 ET AT TIME ZONE 'America/New_York' AT TIME ZONE 'UTC') = 12:00 UTC (EST) or 11:00 UTC (EDT)
```

---

## 🕐 TIMEZONE CONVERSION TABLE

```
┌────────────────┬────────────────┬────────────────┬─────────────────┐
│  Time Set (ET) │ UTC (Standard) │ UTC (Daylight) │ Cron Expression │
├────────────────┼────────────────┼────────────────┼─────────────────┤
│    5:00 AM     │     10:00      │     09:00      │  0 10 * * *     │
│    6:00 AM     │     11:00      │     10:00      │  0 11 * * *     │
│    7:00 AM     │     12:00      │     11:00      │  0 12 * * *     │ ◄── Default
│    8:00 AM     │     13:00      │     12:00      │  0 13 * * *     │
│    9:00 AM     │     14:00      │     13:00      │  0 14 * * *     │
└────────────────┴────────────────┴────────────────┴─────────────────┘

Note: PostgreSQL automatically uses correct offset based on current date (handles DST)
```

---

## 🔄 HOW THE FIX WORKS

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TRIGGER FUNCTION FLOW (FIXED)                        │
└─────────────────────────────────────────────────────────────────────────┘

1. Admin Updates Schedule in UI
   │
   │  User inputs: 7:00 AM
   │  UI sends: { send_time_utc: "07:00:00", send_time_timezone: "America/New_York" }
   │
   ▼

2. Database UPDATE Occurs
   │
   │  daily_email_config table updated
   │
   ▼

3. Trigger Fires: update_daily_email_cron_schedule()
   │
   │  NEW.send_time_utc = "07:00:00"
   │  NEW.send_time_timezone = "America/New_York"
   │
   ▼

4. Timezone Conversion (THE FIX!)
   │
   │  utc_time := (CURRENT_DATE + "07:00:00") 
   │              AT TIME ZONE "America/New_York"   -- Interprets as ET
   │              AT TIME ZONE "UTC"                -- Converts to UTC
   │
   │  Result (EST): 12:00:00
   │  Result (EDT): 11:00:00
   │
   ▼

5. Extract Hours/Minutes
   │
   │  hour_val := 12  (or 11 during EDT)
   │  minute_val := 0
   │
   ▼

6. Build Cron Expression
   │
   │  cron_expr := "0 12 * * *"  (or "0 11 * * *" during EDT)
   │
   ▼

7. Reschedule Cron Job
   │
   │  PERFORM cron.unschedule('daily-agenda-email-cron');
   │  PERFORM cron.schedule('daily-agenda-email-cron', '0 12 * * *', ...);
   │
   ▼

8. Cron Runs at Correct Time
   │
   │  pg_cron executes at 12:00 UTC
   │  = 7:00 AM EST or 7:00 AM EDT
   │
   ▼

9. Email Sent at Configured Time ✅
```

---

## 🐛 YOUR CURRENT SITUATION

```
┌─────────────────────────────────────────────────────────────┐
│              WHY YOU'RE GETTING EMAILS AT 1AM ET            │
└─────────────────────────────────────────────────────────────┘

Current Cron Schedule:  6:00 UTC  (or possibly 5:00 UTC)
                         │
                         ├─▶ During EST: 6:00 UTC = 1:00 AM EST
                         └─▶ During EDT: 6:00 UTC = 2:00 AM EDT
                         
                         OR
                         
                         ├─▶ During EST: 5:00 UTC = 12:00 AM EST
                         └─▶ During EDT: 5:00 UTC = 1:00 AM EDT


Likely Cause:
  Admin set time as: 6:00 AM (thinking it's ET)
  Function treated as: 6:00 UTC (no conversion!)
  Result: Emails at 1:00 AM ET


After Fix:
  Admin sets: 6:00 AM ET
  Function converts: 11:00 UTC (EST) or 10:00 UTC (EDT)
  Result: Emails at 6:00 AM ET ✅
```

---

## 📊 BEFORE vs AFTER COMPARISON

```
╔══════════════════════════════════════════════════════════════════╗
║                       COMPARISON TABLE                           ║
╠═══════════════╤═══════════════════╤═══════════════════════════╣
║   Aspect      │   BEFORE (Bug)    │   AFTER (Fixed)           ║
╠═══════════════╪═══════════════════╪═══════════════════════════╣
║ Conversion    │   None! ❌        │   ET → UTC ✅             ║
║ DST Handling  │   No ❌           │   Automatic ✅            ║
║ Email Timing  │   Wrong ❌        │   Correct ✅              ║
║ UI Label      │   Confusing ❌    │   Clear "ET" ✅           ║
║ Cron Schedule │   Wrong UTC ❌    │   Correct UTC ✅          ║
╚═══════════════╧═══════════════════╧═══════════════════════════╝
```

---

## 🎯 DEPLOYMENT VISUALIZATION

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT PROCESS                           │
└─────────────────────────────────────────────────────────────────┘

Step 1: Open Supabase SQL Editor
   │
   ▼
Step 2: Run QUICK_FIX_EMAIL_SCHEDULE.sql
   │
   │  ┌─────────────────────────────────────┐
   │  │ 1. Drop old function                │
   │  │ 2. Create new function (with fix)   │
   │  │ 3. Recreate trigger                 │
   │  │ 4. Force UPDATE to reschedule       │
   │  │ 5. Show verification output         │
   │  └─────────────────────────────────────┘
   │
   ▼
Step 3: Verify Output
   │
   │  Expected:
   │  ✅ Set Time (ET): 07:00:00
   │  ✅ Actual UTC Time: 12:00:00
   │  ✅ Cron Expression: 0 12 * * *
   │
   ▼
Step 4: Done! Wait for Next Schedule
   │
   │  Cron will run at: 12:00 UTC tomorrow
   │  Emails sent at: 7:00 AM ET ✅
   │
   ▼
Success! 🎉
```

---

## 🔍 HOW TO VERIFY THE FIX

```sql
-- Query 1: Check Configuration
SELECT 
  send_time_utc as "ET Time",
  (
    (CURRENT_DATE + send_time_utc) 
    AT TIME ZONE send_time_timezone 
    AT TIME ZONE 'UTC'
  )::time as "UTC Time",
  send_time_timezone as "Timezone"
FROM daily_email_config;

-- Expected Output:
--   ET Time    | UTC Time  | Timezone
-- -------------+-----------+------------------
--   07:00:00   | 12:00:00  | America/New_York
--              (or 11:00:00 during EDT)


-- Query 2: Check Cron Schedule
SELECT 
  jobname,
  schedule as "Cron Expression",
  active
FROM cron.job 
WHERE jobname = 'daily-agenda-email-cron';

-- Expected Output:
--   jobname                 | Cron Expression | active
-- --------------------------+-----------------+--------
--   daily-agenda-email-cron | 0 12 * * *      | t
--                            (or 0 11 * * * during EDT)
```

---

## ✅ SUCCESS CRITERIA

After deploying the fix:

```
✅ Function converts ET to UTC correctly
✅ Cron expression shows correct UTC hour
✅ Trigger recreated and active
✅ Test email can be sent from admin UI
✅ Next morning: Email arrives at configured ET time
```

---

## 📱 ADMIN UI CHANGES

```
Before:
┌─────────────────────────────────────────┐
│ Daily Send Time (Your Local Time)      │  ◄── Confusing!
│ ┌─────────┐  ┌──────────────┐          │
│ │ 07:00   │  │ Update Time  │          │
│ └─────────┘  └──────────────┘          │
│ Current schedule: Emails sent daily    │
│ at 07:00 (your local time)             │
└─────────────────────────────────────────┘

After:
┌─────────────────────────────────────────┐
│ Daily Send Time (Eastern Time)         │  ◄── Clear!
│ ┌─────────┐  ┌──────────────┐          │
│ │ 07:00   │  │ Update Time  │          │
│ └─────────┘  └──────────────┘          │
│ Current schedule: Emails sent daily    │
│ at 07:00 Eastern Time (ET). The system │
│ will automatically convert this to UTC │
│ for scheduling.                        │  ◄── Helpful!
└─────────────────────────────────────────┘
```

---

**Last Updated:** January 27, 2026  
**Status:** ✅ Ready to Deploy  
**Files:** See EMAIL_SCHEDULE_FIX_ACTION_REQUIRED.md
