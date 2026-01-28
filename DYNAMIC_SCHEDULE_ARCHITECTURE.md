# Dynamic Email Schedule - System Architecture

## Complete System Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ADMIN USER INTERACTION                             │
└────────────────────────────────────┬────────────────────────────────────────┘
                                     │
                                     │ 1. Admin opens settings page
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DailyAgendaEmailSettings.tsx                              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │  Email Schedule Section                                         │        │
│  │  ┌──────────────┐  ┌──────────────┐                           │        │
│  │  │ Time Picker  │  │ Update Time  │                           │        │
│  │  │   [14:00]    │  │   [Button]   │  ◄── 2. User selects time│        │
│  │  └──────────────┘  └──────────────┘                           │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                                                                              │
│  Functions:                                                                 │
│  - fetchEmailConfig() ◄── Loads current time on mount                      │
│  - updateSendTime()   ◄── 3. Saves new time to database                    │
│                                                                              │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 │ supabase.from('daily_email_config').update()
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUPABASE DATABASE                                  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  Table: daily_email_config                                    │          │
│  │  ┌──────────────────────────────────────────────────────┐   │          │
│  │  │ id: uuid                                              │   │          │
│  │  │ send_time_utc: TIME       ◄── 4. Time updated here   │   │          │
│  │  │ send_time_timezone: TEXT                             │   │          │
│  │  │ updated_at: TIMESTAMPTZ                              │   │          │
│  │  │ updated_by: UUID                                     │   │          │
│  │  └──────────────────────────────────────────────────────┘   │          │
│  │                                                               │          │
│  │  RLS Policies: ✅ Admin-only access                          │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                 │                                            │
│                                 │ 5. Trigger fires on UPDATE                │
│                                 ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  Trigger: trigger_update_cron_schedule                        │          │
│  │  WHEN: OLD.send_time_utc ≠ NEW.send_time_utc                │          │
│  │  EXECUTE: update_daily_email_cron_schedule()                 │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                 │                                            │
│                                 ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  Function: update_daily_email_cron_schedule()                 │          │
│  │                                                               │          │
│  │  1. Extract hour and minute from NEW.send_time_utc           │          │
│  │  2. Build cron expression: "MM HH * * *"                     │          │
│  │  3. cron.unschedule('daily-agenda-email-cron')               │          │
│  │  4. cron.schedule('daily-agenda-email-cron', ...)            │          │
│  │                                                               │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                 │                                            │
│                                 │ 6. Cron job rescheduled                   │
│                                 ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  pg_cron Extension                                            │          │
│  │                                                               │          │
│  │  Table: cron.job                                             │          │
│  │  ┌────────────────────────────────────────────────────┐     │          │
│  │  │ jobname: 'daily-agenda-email-cron'                 │     │          │
│  │  │ schedule: '0 14 * * *'  ◄── 7. Updated schedule    │     │          │
│  │  │ command: SELECT net.http_post(...)                 │     │          │
│  │  │ active: true                                       │     │          │
│  │  └────────────────────────────────────────────────────┘     │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                 │                                            │
└─────────────────────────────────┼────────────────────────────────────────────┘
                                  │
                                  │ 8. Waits until scheduled time (14:00 UTC)
                                  │
                 ┌────────────────┼────────────────┐
                 │                ▼                │
                 │    9. Time reaches 14:00 UTC    │
                 │    Cron job executes            │
                 └────────────────┬────────────────┘
                                  │
                                  │ 10. HTTP POST request
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EDGE FUNCTIONS                                       │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  Function: daily-agenda-cron-trigger                          │          │
│  │  Path: /functions/v1/daily-agenda-cron-trigger               │          │
│  │                                                               │          │
│  │  1. Receives cron trigger request                            │          │
│  │  2. Logs trigger event                                       │          │
│  │  3. Calls send-daily-agenda-email function                   │          │
│  │                                                               │          │
│  │  JWT Verification: ❌ DISABLED (allows cron access)           │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                 │                                            │
│                                 │ 11. Internal function call                │
│                                 ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  Function: send-daily-agenda-email                            │          │
│  │  Path: /functions/v1/send-daily-agenda-email                 │          │
│  │                                                               │          │
│  │  1. Query daily_email_settings for enabled users             │          │
│  │  2. For each enabled user:                                   │          │
│  │     a. Fetch today's job data                                │          │
│  │     b. Build HTML email                                      │          │
│  │     c. Send via Resend API                                   │          │
│  │     d. Log result to daily_summary_log                       │          │
│  │  3. Return summary of sent emails                            │          │
│  │                                                               │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                 │                                            │
└─────────────────────────────────┼────────────────────────────────────────────┘
                                  │
                                  │ 12. Emails sent
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RESEND API                                      │
│                                                                              │
│  Delivers emails to:                                                        │
│  ✉️  admin@example.com                                                      │
│  ✉️  manager@example.com                                                    │
│  ✉️  supervisor@example.com                                                 │
│  ✉️  ... (all enabled users)                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ 13. Results logged
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Table: daily_summary_log                                 │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────┐            │
│  │ sent_at: TIMESTAMPTZ                                        │            │
│  │ recipient_email: TEXT                                       │            │
│  │ success: BOOLEAN                                            │            │
│  │ error_message: TEXT (if failed)                             │            │
│  │ job_count: INTEGER                                          │            │
│  └────────────────────────────────────────────────────────────┘            │
│                                                                              │
│  Used for: Monitoring, debugging, audit trail                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## State Changes

### Before Update
```
daily_email_config:  send_time_utc = '12:00:00'
cron.job:            schedule = '0 12 * * *'
Status:              Emails send at 12:00 UTC daily
```

### Admin Changes Time to 14:00
```
1. UI:    setSendTime('14:00')
2. API:   UPDATE daily_email_config SET send_time_utc = '14:00:00'
3. DB:    Trigger fires
4. Func:  update_daily_email_cron_schedule() executes
5. Cron:  Unschedule old, schedule new
```

### After Update
```
daily_email_config:  send_time_utc = '14:00:00'
cron.job:            schedule = '0 14 * * *'
Status:              Emails send at 14:00 UTC daily
```

---

## Data Flow

```
User Input (14:00)
    ↓
TypeScript State
    ↓
Supabase Update Query
    ↓
PostgreSQL Table
    ↓
Database Trigger
    ↓
PL/pgSQL Function
    ↓
pg_cron Reschedule
    ↓
Cron Job Updated
    ↓
(Wait until 14:00 UTC)
    ↓
HTTP POST to Edge Function
    ↓
Edge Function Processes
    ↓
Query Enabled Users
    ↓
Send Emails via Resend
    ↓
Log Results to Database
```

---

## Security Layers

```
┌────────────────────────────┐
│  1. Authentication         │  ◄── User must be logged in
│     auth.uid()             │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│  2. Authorization          │  ◄── User must be admin
│     RLS: role = 'admin'    │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│  3. Table Permissions      │  ◄── GRANT SELECT, UPDATE
│     Only to authenticated  │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│  4. Trigger Permissions    │  ◄── Only fires on actual changes
│     WHEN clause            │
└────────────────────────────┘
```

---

## Error Handling

```
┌─── UI Error Handling ───┐        ┌─── Database Error Handling ───┐
│                          │        │                                │
│ - Invalid time format    │        │ - Transaction rollback         │
│ - Network failures       │        │ - Constraint violations        │
│ - Permission denied      │        │ - Trigger failures             │
│ - Toast notifications    │        │ - Error logging                │
│ - Console logging        │        │ - Atomic operations            │
│                          │        │                                │
└──────────────────────────┘        └────────────────────────────────┘

┌─── Function Error Handling ───┐
│                                 │
│ - Try/catch blocks              │
│ - Detailed error messages       │
│ - Log to daily_summary_log      │
│ - Return error status           │
│ - Continue on partial failure   │
│                                 │
└─────────────────────────────────┘
```

---

## Monitoring Points

```
1. UI Level
   └─► Browser console
   └─► Network requests
   └─► Toast notifications

2. Database Level
   └─► daily_email_config table
   └─► cron.job table
   └─► cron.job_run_details table
   └─► pg_stat_activity

3. Function Level
   └─► Edge Function logs (Supabase dashboard)
   └─► daily_summary_log table
   └─► Function metrics

4. Email Level
   └─► Resend dashboard
   └─► Email delivery status
   └─► Bounce/complaint tracking
```

---

## Key Advantages of This Design

✅ **Automatic** - No manual cron updates needed
✅ **Atomic** - Database triggers ensure consistency
✅ **Transparent** - User just changes time, system handles rest
✅ **Logged** - All changes tracked in database
✅ **Secure** - RLS + authentication + authorization
✅ **Reliable** - Transaction-safe, error handling at every level
✅ **Maintainable** - Clear separation of concerns
✅ **Testable** - Each component can be tested independently

---

## File Organization

```
jg-january-2026/
├── supabase/
│   ├── functions/
│   │   ├── daily-agenda-cron-trigger/
│   │   │   └── index.ts  ◄── Cron entry point
│   │   └── send-daily-agenda-email/
│   │       └── index.ts  ◄── Email sender
│   └── migrations/
│       └── 20260123_add_email_schedule_config.sql  ◄── DB schema
│
├── src/
│   └── components/
│       └── DailyAgendaEmailSettings.tsx  ◄── Admin UI
│
├── DYNAMIC_SCHEDULE_COMPLETE_SUMMARY.md  ◄── Full docs
├── DYNAMIC_SCHEDULE_TESTING_GUIDE.md      ◄── Test procedures
├── DYNAMIC_SCHEDULE_QUICK_REF.md          ◄── Quick reference
├── test_schedule_change.sql               ◄── Verification script
└── apply_schedule_migration.sh            ◄── Deployment script
```
