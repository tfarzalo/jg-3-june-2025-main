# ✅ CRON JOB VERIFICATION & TESTING

## Quick Verification Queries

Run these in Supabase SQL Editor to verify everything is working:

### 1. Check Cron Job Exists
```sql
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  active
FROM cron.job
WHERE jobname = 'auto-decline-expired-assignments';
```

**Expected Result:**
- `active` should be `true`
- `schedule` should be `0 * * * *`
- `command` should be `SELECT auto_decline_expired_assignments();`

---

### 2. Test the Function Manually
```sql
-- This will immediately check for and auto-decline any expired assignments
SELECT auto_decline_expired_assignments();
```

**Expected Result:**
- Returns JSON with `success: true` and `declined_count: X`
- If `declined_count` is 0, that's fine - means no expired assignments right now

---

### 3. Create a Test Scenario

Let's create a test assignment that should auto-decline:

```sql
-- Step 1: Find a test job (replace with actual job ID)
SELECT id, work_order_num, status, assigned_to 
FROM jobs 
WHERE status = 'pending' 
LIMIT 1;

-- Step 2: Assign it to a subcontractor with a past deadline
-- (Replace 'YOUR_JOB_ID' and 'YOUR_SUBCONTRACTOR_ID' with real UUIDs)
UPDATE jobs 
SET 
  assigned_to = 'YOUR_SUBCONTRACTOR_ID',
  assignment_deadline = NOW() - INTERVAL '1 hour', -- 1 hour in the past
  status = 'pending'
WHERE id = 'YOUR_JOB_ID';

-- Step 3: Run the auto-decline function manually
SELECT auto_decline_expired_assignments();

-- Step 4: Verify the job was auto-declined
SELECT 
  id,
  work_order_num,
  status,
  assigned_to,
  assignment_deadline
FROM jobs
WHERE id = 'YOUR_JOB_ID';
-- Should show: status = 'unassigned', assigned_to = NULL, assignment_deadline = NULL

-- Step 5: Check the activity log
SELECT 
  created_at,
  action,
  description
FROM job_activity_logs
WHERE job_id = 'YOUR_JOB_ID'
ORDER BY created_at DESC
LIMIT 5;
-- Should show 'assignment_auto_declined' as the most recent entry
```

---

### 4. Monitor Cron Execution History

```sql
-- View the last 10 cron job executions
SELECT 
  jr.runid,
  jr.start_time,
  jr.end_time,
  jr.status,
  jr.return_message,
  EXTRACT(EPOCH FROM (jr.end_time - jr.start_time)) as execution_seconds
FROM cron.job_run_details jr
JOIN cron.job j ON jr.job_id = j.jobid
WHERE j.jobname = 'auto-decline-expired-assignments'
ORDER BY jr.start_time DESC
LIMIT 10;
```

**What to look for:**
- Recent executions (should run every hour)
- `status` should be 'succeeded'
- `execution_seconds` should be < 5 seconds typically

---

## ✅ Verification Complete!

If all the above checks pass, your cron job is working perfectly!

**Next step:** Deploy the frontend!
