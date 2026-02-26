# 🔍 Countdown Timer Not Showing - Debugging Steps

## Issue
Countdown timer not visible in:
1. Subcontractor Dashboard
2. SubScheduler (admin view)

## ✅ Code Changes Made

### 1. SubScheduler.tsx Updated
- ✅ Added `import { AssignmentCountdownTimer } from './AssignmentCountdownTimer'`
- ✅ Added `assignment_deadline?: string | null;` to Job interface
- ✅ Added countdown timer component to job card display

### 2. SubcontractorDashboard.tsx
- ✅ Already has countdown timer code
- ✅ Already imports AssignmentCountdownTimer
- ✅ Already has assignment_deadline in interface

---

## 🐛 Possible Causes

### Cause 1: Job Status Not 'pending'
The countdown only shows when:
```tsx
job.assignment_status === 'pending' && job.assignment_deadline
```

**Check:**
```sql
-- What is the actual status of your test job?
SELECT 
  id,
  work_order_num,
  status,
  assigned_to,
  assignment_status,  -- This should be 'pending'
  assignment_deadline,
  current_phase_id
FROM jobs
WHERE assigned_to IS NOT NULL
ORDER BY assigned_at DESC
LIMIT 5;
```

### Cause 2: Column Name Mismatch
Check if the column is actually called `assignment_status` or something else:

```sql
-- Check actual column names
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'jobs'
AND column_name LIKE '%status%'
ORDER BY column_name;
```

### Cause 3: Function Not Setting Status Correctly
The assign function might be setting a different status field:

```sql
-- Check what the function actually sets
SELECT 
  id,
  work_order_num,
  status,                   -- Main job status
  assignment_status,        -- Assignment-specific status
  assigned_to,
  assignment_deadline
FROM jobs
WHERE id = 'YOUR_TEST_JOB_ID';
```

---

## 🔧 Quick Fixes

### Fix 1: Update Job Status Manually
If your test job has the wrong status:

```sql
-- Set status to 'pending' manually for testing
UPDATE jobs
SET assignment_status = 'pending'
WHERE id = 'YOUR_TEST_JOB_ID';

-- Verify
SELECT 
  work_order_num,
  assignment_status,
  assignment_deadline
FROM jobs
WHERE id = 'YOUR_TEST_JOB_ID';
```

### Fix 2: Check Assignment Function
Verify the function sets the correct status:

```sql
-- Test the assignment function
SELECT assign_job_to_subcontractor(
  'JOB_ID'::uuid,
  'SUBCONTRACTOR_ID'::uuid,
  'ADMIN_ID'::uuid
);

-- Check the result
SELECT 
  work_order_num,
  status,
  assignment_status,
  assignment_deadline,
  (assignment_deadline AT TIME ZONE 'America/New_York')::timestamp as deadline_et
FROM jobs
WHERE id = 'JOB_ID';
```

### Fix 3: Dev Server Restart
The TypeScript changes need a rebuild:

```bash
# Stop the dev server (Ctrl+C)
# Then restart:
npm run dev
```

---

## 📋 Debugging Checklist

Run these checks in order:

### 1. Check Job Data
```sql
SELECT 
  id,
  work_order_num,
  status,
  assignment_status,
  assignment_deadline,
  assigned_to,
  current_phase_id
FROM jobs
WHERE assigned_to IS NOT NULL
AND assignment_deadline IS NOT NULL
ORDER BY assigned_at DESC
LIMIT 3;
```

**Expected:**
- ✅ `assignment_status` = 'pending'
- ✅ `assignment_deadline` is set (not null)
- ✅ `assigned_to` has a user ID

### 2. Check User Is Logged In
- ✅ Subcontractor is logged in to correct account
- ✅ User ID matches the `assigned_to` value

### 3. Check Job Phase
SubcontractorDashboard only shows "Job Request" phase:

```sql
-- Check if job is in Job Request phase
SELECT 
  j.id,
  j.work_order_num,
  jp.job_phase_label,
  j.current_phase_id
FROM jobs j
LEFT JOIN job_phases jp ON j.current_phase_id = jp.id
WHERE j.id = 'YOUR_TEST_JOB_ID';
```

**Expected:** `job_phase_label` = 'Job Request'

### 4. Check Browser Console
- Open DevTools (F12)
- Look for errors in Console
- Check Network tab for failed requests
- Look for countdown timer element in Elements tab

### 5. Check Component Rendering
Add this to browser console while on dashboard:

```javascript
// Check if job has required fields
console.log('Jobs:', document.querySelector('[data-job-id]'));
```

---

## 🚀 Quick Test Steps

### Step 1: Assign Fresh Job
```sql
-- Get IDs
SELECT id FROM jobs WHERE status = 'unassigned' LIMIT 1;  -- Job ID
SELECT id FROM users WHERE user_role = 'subcontractor' LIMIT 1;  -- Sub ID
SELECT id FROM users WHERE user_role = 'admin' AND email = 'your@email.com' LIMIT 1;  -- Admin ID

-- Assign
SELECT assign_job_to_subcontractor(
  'JOB_ID'::uuid,
  'SUB_ID'::uuid,
  'ADMIN_ID'::uuid
);
```

### Step 2: Verify in Database
```sql
SELECT 
  work_order_num,
  assignment_status,  -- Must be 'pending'
  assignment_deadline,  -- Must be set
  (assignment_deadline AT TIME ZONE 'America/New_York')::timestamp as deadline_et  -- Must be 15:30
FROM jobs
WHERE id = 'JOB_ID';
```

### Step 3: Restart Dev Server
```bash
# Stop server (Ctrl+C)
npm run dev
```

### Step 4: Test in Browser
1. Open http://localhost:5174/
2. Log in as the subcontractor
3. Go to Dashboard
4. **Look for countdown timer** on the assigned job

### Step 5: Check Scheduler
1. Log out, log in as admin
2. Go to Scheduler
3. Find the subcontractor
4. **Look for countdown timer** on their assigned job card

---

## 💡 Common Issues & Solutions

### Issue: "Assignment status is null"
**Solution:**
```sql
UPDATE jobs
SET assignment_status = 'pending'
WHERE assigned_to IS NOT NULL
AND assignment_deadline IS NOT NULL
AND assignment_status IS NULL;
```

### Issue: "Job not in Job Request phase"
**Solution:**
```sql
-- Get Job Request phase ID
SELECT id FROM job_phases WHERE job_phase_label = 'Job Request';

-- Update job phase
UPDATE jobs
SET current_phase_id = 'JOB_REQUEST_PHASE_ID'
WHERE id = 'YOUR_JOB_ID';
```

### Issue: "Countdown timer component not found"
**Solution:** Check that `AssignmentCountdownTimer.tsx` exists in `src/components/`

### Issue: "Changes not reflecting in browser"
**Solution:** 
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
3. Restart dev server

---

## ✅ Success Criteria

Countdown timer should show when ALL of these are true:

1. ✅ `assignment_status` = 'pending'
2. ✅ `assignment_deadline` is set (not null)
3. ✅ User is logged in as the assigned subcontractor
4. ✅ Job is in "Job Request" phase (for dashboard)
5. ✅ Dev server has been restarted after code changes
6. ✅ Browser has been refreshed

---

## 🎯 Next Steps

1. **Run `debug_countdown_issue.sql`** to check your job data
2. **Fix any issues** found (status, deadline, phase)
3. **Restart dev server** to apply code changes
4. **Refresh browser** and test again
5. **Check browser console** for any errors

Let me know what you find!
