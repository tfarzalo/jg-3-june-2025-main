# 🧪 AUTO-DECLINE FEATURE - TESTING GUIDE

## Testing Checklist

Before deploying to production, test each component to ensure everything works correctly.

---

## 1️⃣ Verify Cron Job Setup (2 minutes)

### Check Cron Job Exists
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
- `jobname`: auto-decline-expired-assignments
- `schedule`: 0 * * * *
- `active`: true

### Check Database Function Works
Test the auto-decline function manually:

```sql
-- Call the function directly
SELECT auto_decline_expired_assignments();
```

**Expected Result:**
- Returns JSON with `success: true` and `declined_count: 0` (if no expired assignments)

---

## 2️⃣ Test Deadline Calculation (5 minutes)

### Test Different Assignment Times

```sql
-- Test 1: Assigned at 9:00 AM ET (should be same day 3:30 PM ET)
SELECT 
  'Test 1: Assigned at 9:00 AM ET' as test_case,
  calculate_assignment_deadline(TIMESTAMP '2026-02-25 14:00:00+00') as deadline_utc,
  (calculate_assignment_deadline(TIMESTAMP '2026-02-25 14:00:00+00') AT TIME ZONE 'America/New_York')::timestamp as deadline_et;

-- Test 2: Assigned at 3:15 PM ET (should be same day 3:30 PM ET)
SELECT 
  'Test 2: Assigned at 3:15 PM ET' as test_case,
  calculate_assignment_deadline(TIMESTAMP '2026-02-25 20:15:00+00') as deadline_utc,
  (calculate_assignment_deadline(TIMESTAMP '2026-02-25 20:15:00+00') AT TIME ZONE 'America/New_York')::timestamp as deadline_et;

-- Test 3: Assigned at 4:00 PM ET (should be next business day 3:30 PM ET)
SELECT 
  'Test 3: Assigned at 4:00 PM ET' as test_case,
  calculate_assignment_deadline(TIMESTAMP '2026-02-25 21:00:00+00') as deadline_utc,
  (calculate_assignment_deadline(TIMESTAMP '2026-02-25 21:00:00+00') AT TIME ZONE 'America/New_York')::timestamp as deadline_et;

-- Test 4: Assigned on Friday at 5:00 PM ET (should be Monday 3:30 PM ET)
SELECT 
  'Test 4: Assigned on Friday at 5:00 PM ET' as test_case,
  calculate_assignment_deadline(TIMESTAMP '2026-02-27 22:00:00+00') as deadline_utc,
  (calculate_assignment_deadline(TIMESTAMP '2026-02-27 22:00:00+00') AT TIME ZONE 'America/New_York')::timestamp as deadline_et;
```

**Expected Results:**
- Test 1: deadline_et = 2026-02-25 15:30:00 (same day)
- Test 2: deadline_et = 2026-02-25 15:30:00 (same day, 15 min later)
- Test 3: deadline_et = 2026-02-26 15:30:00 (next day)
- Test 4: deadline_et = 2026-03-02 15:30:00 (skip weekend)

---

## 3️⃣ Test Assignment with Real Job (10 minutes)

### Step 1: Create or Find a Test Job

```sql
-- Find an unassigned job to test with
SELECT 
  id,
  work_order_num,
  status,
  assigned_to
FROM jobs
WHERE status IN ('unassigned', 'pending')
LIMIT 1;
```

**Note the job ID for next steps.**

### Step 2: Find Test Subcontractor

```sql
-- Find a subcontractor user to test with
SELECT 
  id,
  email,
  full_name
FROM users
WHERE user_role = 'subcontractor'
LIMIT 1;
```

**Note the user ID for next steps.**

### Step 3: Assign Job with Deadline

Replace `YOUR_JOB_ID`, `YOUR_SUBCONTRACTOR_ID`, and `YOUR_ADMIN_ID`:

```sql
-- Assign the job using the function
SELECT assign_job_to_subcontractor(
  'YOUR_JOB_ID'::uuid,
  'YOUR_SUBCONTRACTOR_ID'::uuid,
  'YOUR_ADMIN_ID'::uuid
);
```

**Expected Result:**
- Returns JSON with success: true
- Job status changes to 'pending'
- `assignment_deadline` is set
- Activity log entry created

### Step 4: Verify Assignment in Database

```sql
-- Check the job was assigned correctly
SELECT 
  id,
  work_order_num,
  status,
  assigned_to,
  assignment_deadline,
  (assignment_deadline AT TIME ZONE 'America/New_York')::timestamp as deadline_et,
  EXTRACT(EPOCH FROM (assignment_deadline - NOW())) / 3600 as hours_remaining
FROM jobs
WHERE id = 'YOUR_JOB_ID';
```

**Verify:**
- ✅ `status` = 'pending'
- ✅ `assigned_to` = subcontractor user ID
- ✅ `assignment_deadline` is set to correct time
- ✅ `hours_remaining` makes sense

### Step 5: Check Activity Log

```sql
-- Check activity log for assignment entry
SELECT 
  action,
  description,
  created_at
FROM job_activity_logs
WHERE job_id = 'YOUR_JOB_ID'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:**
- Entry with action = 'job_assigned'
- Description mentions subcontractor name

---

## 4️⃣ Test Frontend Locally (15 minutes)

### Step 1: Start Development Server

```bash
npm run dev
```

### Step 2: Test Countdown Timer

1. **Open browser** to local dev URL (usually http://localhost:5173)
2. **Log in** as the subcontractor you assigned the job to
3. **Navigate** to Dashboard
4. **Verify countdown timer appears:**
   - ✅ Shows correct time remaining
   - ✅ Updates every second
   - ✅ Shows urgency indicator (color changes)
   - ✅ Format is clear (e.g., "2h 15m remaining")

### Step 3: Test in Scheduler View

1. **Log in** as an admin
2. **Navigate** to Scheduler
3. **Find the assigned job**
4. **Verify countdown timer shows** in scheduler view

### Step 4: Browser Console Check

- Open browser console (F12)
- Look for any errors
- Verify real-time subscription is connected

---

## 5️⃣ Test Accept Job Flow (5 minutes)

### Step 1: Accept Job in UI

1. **Log in** as subcontractor
2. **Find the pending job** with countdown timer
3. **Click "Accept" button**
4. **Verify:**
   - ✅ Job disappears from pending list or status changes
   - ✅ Countdown timer disappears
   - ✅ Success message shows
   - ✅ No errors in console

### Step 2: Verify in Database

```sql
-- Check job was accepted correctly
SELECT 
  id,
  work_order_num,
  status,
  assigned_to,
  assignment_deadline
FROM jobs
WHERE id = 'YOUR_JOB_ID';
```

**Verify:**
- ✅ `status` = 'accepted' (or similar)
- ✅ `assignment_deadline` is NULL (cleared)
- ✅ `assigned_to` still set

### Step 3: Check Activity Log

```sql
-- Check activity log for acceptance
SELECT 
  action,
  description,
  created_at
FROM job_activity_logs
WHERE job_id = 'YOUR_JOB_ID'
ORDER BY created_at DESC
LIMIT 3;
```

**Expected:**
- New entry with action = 'assignment_accepted'
- Description mentions acceptance

---

## 6️⃣ Test Decline Job Flow (5 minutes)

### Step 1: Assign Another Job

Repeat Step 3 from section 3 with a different job.

### Step 2: Decline Job in UI

1. **Log in** as subcontractor
2. **Find the pending job**
3. **Click "Decline" button**
4. **Enter decline reason** (if prompted)
5. **Submit decline**
6. **Verify:**
   - ✅ Job disappears from pending list
   - ✅ Success message shows
   - ✅ No errors in console

### Step 3: Verify in Database

```sql
-- Check job was declined correctly
SELECT 
  id,
  work_order_num,
  status,
  assigned_to,
  assignment_deadline
FROM jobs
WHERE id = 'YOUR_JOB_ID';
```

**Verify:**
- ✅ `status` = 'unassigned' (or similar)
- ✅ `assignment_deadline` is NULL (cleared)
- ✅ `assigned_to` is NULL (cleared)

### Step 4: Check Activity Log

```sql
-- Check activity log for decline
SELECT 
  action,
  description,
  created_at
FROM job_activity_logs
WHERE job_id = 'YOUR_JOB_ID'
ORDER BY created_at DESC
LIMIT 3;
```

**Expected:**
- New entry with action = 'assignment_declined'
- Description includes decline reason if provided

---

## 7️⃣ Test Auto-Decline (10 minutes)

### Step 1: Create Expired Assignment

```sql
-- Assign a job and immediately expire it for testing
-- Step 1: Assign the job
SELECT assign_job_to_subcontractor(
  'YOUR_JOB_ID'::uuid,
  'YOUR_SUBCONTRACTOR_ID'::uuid,
  'YOUR_ADMIN_ID'::uuid
);

-- Step 2: Manually set deadline to past time
UPDATE jobs
SET assignment_deadline = NOW() - INTERVAL '1 hour'
WHERE id = 'YOUR_JOB_ID';

-- Step 3: Verify it's expired
SELECT 
  id,
  work_order_num,
  status,
  assigned_to,
  assignment_deadline,
  (assignment_deadline < NOW()) as is_expired
FROM jobs
WHERE id = 'YOUR_JOB_ID';
```

**Verify:** `is_expired` = true

### Step 2: Manually Trigger Auto-Decline

```sql
-- Run the auto-decline function
SELECT auto_decline_expired_assignments();
```

**Expected Result:**
- Returns JSON with `declined_count: 1` (or higher)

### Step 3: Verify Job Was Auto-Declined

```sql
-- Check job was auto-declined
SELECT 
  id,
  work_order_num,
  status,
  assigned_to,
  assignment_deadline
FROM jobs
WHERE id = 'YOUR_JOB_ID';
```

**Verify:**
- ✅ `status` = 'unassigned'
- ✅ `assignment_deadline` is NULL
- ✅ `assigned_to` is NULL

### Step 4: Check Activity Log

```sql
-- Check activity log for auto-decline
SELECT 
  action,
  description,
  created_at
FROM job_activity_logs
WHERE job_id = 'YOUR_JOB_ID'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:**
- New entry with action = 'assignment_auto_declined'
- Description mentions auto-decline and deadline

---

## 8️⃣ Test Real-Time Updates (5 minutes)

### Step 1: Open Two Browser Windows

1. **Window 1:** Admin logged in, on Scheduler
2. **Window 2:** Subcontractor logged in, on Dashboard

### Step 2: Assign Job from Admin

In Window 1 (admin):
- Assign a job to the subcontractor

### Step 3: Verify Real-Time Update

In Window 2 (subcontractor):
- **Verify:** Job appears automatically without page refresh
- **Verify:** Countdown timer starts immediately

### Step 4: Accept/Decline from Subcontractor

In Window 2 (subcontractor):
- Accept or decline the job

### Step 5: Verify Real-Time Update in Admin

In Window 1 (admin):
- **Verify:** Job status updates automatically
- **Verify:** Countdown timer disappears

---

## 9️⃣ Test Edge Cases (10 minutes)

### Test 1: Weekend Assignment
```sql
-- If today is Friday after 3:30 PM
SELECT calculate_assignment_deadline(NOW());
-- Should return Monday at 3:30 PM ET
```

### Test 2: Multiple Jobs Same Subcontractor
- Assign 3 jobs to same subcontractor
- Verify each has its own countdown timer
- Accept one, verify others still show

### Test 3: Countdown Timer at Different Times
- Assign job in morning (hours remaining)
- Assign job at 3:25 PM (5 minutes remaining)
- Verify urgency indicators work

### Test 4: Page Refresh
- Assign job to subcontractor
- Refresh browser page
- Verify countdown timer persists and is accurate

### Test 5: Network Disconnection
- Assign job
- Disable network briefly
- Re-enable network
- Verify real-time updates reconnect

---

## 🔍 Verification Checklist

Before deploying to production, ensure:

- [ ] ✅ Cron job is active and scheduled
- [ ] ✅ Database function returns expected results
- [ ] ✅ Deadline calculation is correct for all scenarios
- [ ] ✅ Assignment creates deadline and activity log
- [ ] ✅ Countdown timer displays correctly in dashboard
- [ ] ✅ Countdown timer displays correctly in scheduler
- [ ] ✅ Countdown timer updates every second
- [ ] ✅ Accept clears deadline and updates status
- [ ] ✅ Decline clears assignment and updates status
- [ ] ✅ Auto-decline works on expired assignments
- [ ] ✅ Activity logs record all actions correctly
- [ ] ✅ Real-time updates work without refresh
- [ ] ✅ Weekend logic works correctly
- [ ] ✅ No console errors in browser
- [ ] ✅ No errors in Supabase logs
- [ ] ✅ Multiple assignments work correctly

---

## 📊 Monitoring During Testing

### Watch Activity Logs in Real-Time

```sql
-- Monitor all assignment activities
SELECT 
  jal.created_at,
  jal.action,
  jal.description,
  j.work_order_num,
  u.full_name as user_name
FROM job_activity_logs jal
JOIN jobs j ON jal.job_id = j.id
LEFT JOIN users u ON jal.user_id = u.id
WHERE jal.action IN (
  'job_assigned',
  'assignment_accepted', 
  'assignment_declined',
  'assignment_auto_declined'
)
ORDER BY jal.created_at DESC
LIMIT 20;
```

### Watch Current Pending Assignments

```sql
-- Monitor all active pending assignments
SELECT 
  j.work_order_num,
  j.status,
  u.full_name as assigned_to,
  j.assignment_deadline,
  (j.assignment_deadline AT TIME ZONE 'America/New_York')::timestamp as deadline_et,
  CASE
    WHEN EXTRACT(EPOCH FROM (j.assignment_deadline - NOW())) / 3600 < 1 THEN '🔴 URGENT'
    WHEN EXTRACT(EPOCH FROM (j.assignment_deadline - NOW())) / 3600 < 4 THEN '🟡 SOON'
    ELSE '🟢 OK'
  END as urgency,
  EXTRACT(EPOCH FROM (j.assignment_deadline - NOW())) / 3600 as hours_remaining
FROM jobs j
LEFT JOIN users u ON j.assigned_to = u.id
WHERE j.status = 'pending'
AND j.assignment_deadline IS NOT NULL
ORDER BY j.assignment_deadline;
```

### Check Cron Job History

```sql
-- View cron execution history
SELECT 
  jr.runid,
  jr.start_time,
  jr.end_time,
  jr.status,
  jr.return_message,
  EXTRACT(EPOCH FROM (jr.end_time - jr.start_time)) as duration_seconds
FROM cron.job_run_details jr
JOIN cron.job j ON jr.job_id = j.jobid
WHERE j.jobname = 'auto-decline-expired-assignments'
ORDER BY jr.start_time DESC
LIMIT 10;
```

---

## 🐛 Common Issues & Solutions

### Issue: Countdown timer not showing
**Check:**
- Is user logged in as the assigned subcontractor?
- Does job have `assignment_deadline` set?
- Is job status 'pending'?
- Any browser console errors?

### Issue: Timer showing wrong time
**Check:**
- Timezone handling (should be America/New_York)
- Clock sync on server and client
- Deadline calculation function

### Issue: Auto-decline not working
**Check:**
- Is cron job active?
- Check cron execution history
- Run function manually to test
- Check for errors in Supabase logs

### Issue: Real-time updates not working
**Check:**
- Supabase real-time enabled for jobs table
- Browser console for subscription errors
- Network connectivity
- RLS policies

---

## ✅ Testing Complete?

Once all tests pass and the checklist is complete:

1. **Document any issues found** and fixes applied
2. **Prepare production deployment**
3. **Communicate feature rollout** to users
4. **Deploy to production**
5. **Monitor closely** for first 24 hours

---

## 🚀 Ready for Production?

If all tests passed, proceed with:
```bash
npm run build
netlify deploy --prod
```

Then monitor the production environment closely!
