# 🕐 Cron Job Setup Instructions

## Option 1: Enable pg_cron First (Recommended)

### Step 1: Enable pg_cron Extension
1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh
2. Navigate to **Database** → **Extensions**
3. Search for `pg_cron`
4. Click **Enable**

### Step 2: Run the SQL File
After pg_cron is enabled, run:
- **File:** `setup_auto_decline_cron.sql`

---

## Option 2: Use Supabase Dashboard (Easiest)

### Setup via Dashboard UI
1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh
2. Navigate to **Database** → **Cron Jobs** (or **Database** → **Extensions** → **pg_cron**)
3. Click **Create a new cron job**
4. Fill in the form:

**Name:**
```
auto-decline-expired-assignments
```

**Schedule (cron expression):**
```
0 * * * *
```
(This means: run at minute 0 of every hour)

**SQL Command:**
```sql
SELECT net.http_post(
  url := 'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/auto-decline-jobs',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
  ),
  body := '{}'::jsonb
) as request_id;
```

5. Click **Create**

---

## Option 3: Call Database Function Directly (Alternative)

If you prefer to call the database function instead of the Edge Function:

**SQL Command:**
```sql
SELECT auto_decline_expired_assignments();
```

**Pros:**
- Simpler, no HTTP call needed
- Faster execution
- No external dependencies

**Cons:**
- Edge Function won't get invoked directly
- Less flexible for future enhancements

---

## Verify Cron Job is Running

After setup, verify with this query:

```sql
-- Check if cron job exists
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'auto-decline-expired-assignments';
```

---

## Check Cron Job Execution History

```sql
-- View recent executions
SELECT 
  jr.runid,
  jr.job_id,
  jr.start_time,
  jr.end_time,
  jr.status,
  jr.return_message,
  j.jobname
FROM cron.job_run_details jr
JOIN cron.job j ON jr.job_id = j.jobid
WHERE j.jobname = 'auto-decline-expired-assignments'
ORDER BY jr.start_time DESC
LIMIT 10;
```

---

## Test the Cron Job Manually

Before waiting for the hourly execution, test it manually:

### Method 1: Call Edge Function Directly
```bash
curl -X POST \
  'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/auto-decline-jobs' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

### Method 2: Call Database Function Directly
```sql
SELECT auto_decline_expired_assignments();
```

### Method 3: Force an Immediate Cron Execution
```sql
-- Temporarily change schedule to run immediately
UPDATE cron.job
SET schedule = '* * * * *' -- Run every minute
WHERE jobname = 'auto-decline-expired-assignments';

-- Wait 1-2 minutes, then check execution history

-- Change back to hourly
UPDATE cron.job
SET schedule = '0 * * * *' -- Run every hour
WHERE jobname = 'auto-decline-expired-assignments';
```

---

## Troubleshooting

### Error: "extension pg_cron does not exist"
**Solution:** Enable pg_cron extension in Supabase Dashboard → Database → Extensions

### Error: "function cron.schedule does not exist"
**Solution:** pg_cron is not enabled. Use Supabase Dashboard to enable it.

### Error: "permission denied for schema cron"
**Solution:** Use Supabase Dashboard UI to create cron job instead of SQL.

### Cron job not executing
**Solutions:**
1. Check if job is active: `SELECT * FROM cron.job;`
2. Check execution logs: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC;`
3. Verify Edge Function is deployed and accessible
4. Check service role key configuration

---

## Recommended Approach

**Use Supabase Dashboard UI (Option 2)** - It's the easiest and most reliable method for managed Supabase projects. The dashboard handles all permissions automatically.

Once the cron job is set up via the dashboard, you can verify it with SQL queries, but creation through the UI avoids permission issues.
