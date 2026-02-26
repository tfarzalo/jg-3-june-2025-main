# 🧪 Testing Countdown Timer - Step by Step

## Step 1: Prepare Test Data (2 minutes)

### Find a Test Job
Run this in Supabase SQL Editor:

```sql
-- Find an unassigned job to test with
SELECT 
  id,
  work_order_num,
  status,
  assigned_to,
  property_id
FROM jobs
WHERE status IN ('unassigned', 'pending')
AND assigned_to IS NULL
LIMIT 5;
```

**Copy the job `id` from one of these jobs.**

---

### Find a Test Subcontractor
```sql
-- Find a subcontractor to assign to
SELECT 
  id,
  email,
  full_name,
  user_role
FROM users
WHERE user_role = 'subcontractor'
LIMIT 5;
```

**Copy the subcontractor `id` and note their email.**

---

### Get Your Admin User ID
```sql
-- Find your admin user ID
SELECT 
  id,
  email,
  full_name,
  user_role
FROM users
WHERE user_role = 'admin'
AND email = 'your-email@example.com'; -- Replace with your email
```

**Copy your admin `id`.**

---

## Step 2: Assign the Job (1 minute)

### Use the Assignment Function
Replace the UUIDs with the ones you copied above:

```sql
-- Assign the job
SELECT assign_job_to_subcontractor(
  'JOB_ID_HERE'::uuid,
  'SUBCONTRACTOR_ID_HERE'::uuid,
  'YOUR_ADMIN_ID_HERE'::uuid
);
```

**Expected Result:**
```json
{
  "success": true,
  "job_id": "...",
  "work_order_num": 123,
  "status": "pending",
  "deadline": "2026-02-25T20:30:00Z",
  "message": "Job WO-000123 assigned to John Doe. Deadline: Feb 25 at 3:30 PM ET"
}
```

---

### Verify the Assignment
```sql
-- Check the job was assigned correctly
SELECT 
  id,
  work_order_num,
  status,
  assigned_to,
  assignment_deadline,
  (assignment_deadline AT TIME ZONE 'America/New_York')::timestamp as deadline_et,
  EXTRACT(HOUR FROM (assignment_deadline AT TIME ZONE 'America/New_York')::timestamp) as deadline_hour,
  EXTRACT(MINUTE FROM (assignment_deadline AT TIME ZONE 'America/New_York')::timestamp) as deadline_minute,
  ROUND(EXTRACT(EPOCH FROM (assignment_deadline - NOW())) / 60) as minutes_remaining
FROM jobs
WHERE id = 'JOB_ID_HERE';
```

**Verify:**
- ✅ `status` = 'pending'
- ✅ `assigned_to` = subcontractor ID
- ✅ `deadline_hour` = 15 (3 PM)
- ✅ `deadline_minute` = 30
- ✅ `minutes_remaining` > 0

---

### Check Activity Log
```sql
-- Verify activity log entry
SELECT 
  action,
  description,
  created_at
FROM job_activity_logs
WHERE job_id = 'JOB_ID_HERE'
ORDER BY created_at DESC
LIMIT 3;
```

**Expected:** Entry with action = 'job_assigned'

---

## Step 3: Test Countdown Timer in UI (5 minutes)

### View as Subcontractor

1. **Open browser:** http://localhost:5174/
2. **Log in** with the subcontractor's email
3. **Go to Dashboard**
4. **Look for the assigned job**

**What to verify:**
- ✅ Job appears in dashboard
- ✅ **Countdown timer is visible**
- ✅ Timer shows correct time remaining (e.g., "4h 23m remaining")
- ✅ Timer counts down every second
- ✅ Timer shows urgency indicator (color changes as deadline approaches)
- ✅ Deadline text shows "3:30 PM ET" or similar

### View as Admin

1. **Log out** and **log in** as admin
2. **Go to Scheduler** (or Jobs page)
3. **Find the assigned job**

**What to verify:**
- ✅ Countdown timer visible in scheduler view
- ✅ Shows same deadline as subcontractor sees

---

## Step 4: Test Accept Flow (2 minutes)

### Accept the Job

1. **Log back in** as the subcontractor
2. **Find the pending job** with countdown timer
3. **Click "Accept" button**

**What to verify:**
- ✅ Success message appears
- ✅ Countdown timer disappears
- ✅ Job status changes (or job moves to different section)
- ✅ No console errors

### Verify in Database

```sql
-- Check job was accepted
SELECT 
  work_order_num,
  status,
  assigned_to,
  assignment_deadline
FROM jobs
WHERE id = 'JOB_ID_HERE';
```

**Expected:**
- ✅ `status` changed (e.g., to 'accepted', 'in_progress', or similar)
- ✅ `assignment_deadline` = NULL (cleared)
- ✅ `assigned_to` still set

### Check Activity Log

```sql
-- Verify acceptance logged
SELECT 
  action,
  description,
  created_at
FROM job_activity_logs
WHERE job_id = 'JOB_ID_HERE'
ORDER BY created_at DESC
LIMIT 3;
```

**Expected:** New entry with action = 'assignment_accepted'

---

## Step 5: Test Decline Flow (Optional - 2 minutes)

If you want to test decline, assign another job and:

1. **Assign another test job** (repeat Step 2)
2. **Log in as subcontractor**
3. **Click "Decline" button**
4. **Enter decline reason** (if prompted)
5. **Submit**

**What to verify:**
- ✅ Success message appears
- ✅ Countdown timer disappears
- ✅ Job removed from pending list
- ✅ No console errors

**Database verification:**
```sql
-- Should show unassigned
SELECT status, assigned_to, assignment_deadline
FROM jobs
WHERE id = 'SECOND_JOB_ID_HERE';
```

**Expected:**
- ✅ `status` = 'unassigned'
- ✅ `assignment_deadline` = NULL
- ✅ `assigned_to` = NULL

---

## 🎯 Quick Testing Checklist

- [ ] Find test job, subcontractor, and admin IDs
- [ ] Assign job using SQL function
- [ ] Verify deadline is 3:30 PM ET (15:30)
- [ ] Log in as subcontractor and see countdown timer
- [ ] Timer updates every second
- [ ] Timer shows correct time remaining
- [ ] Accept job clears timer
- [ ] Activity log records all actions
- [ ] No errors in browser console

---

## 🚨 What to Watch For

### Common Issues:

**Timer doesn't appear:**
- Check job status is 'pending'
- Check assignment_deadline is set
- Check you're logged in as the assigned subcontractor
- Check browser console for errors

**Timer shows wrong time:**
- Verify deadline in database is 15:30 (3:30 PM) ET
- Check timezone on your computer
- Verify calculation function was updated

**Accept/Decline doesn't work:**
- Check browser console for errors
- Check network tab for failed requests
- Verify RLS policies allow the action

---

## ✅ Success Criteria

Your test is successful if:

1. ✅ Job assigns with deadline at 3:30 PM ET
2. ✅ Countdown timer appears and counts down
3. ✅ Accept clears timer and updates status
4. ✅ All actions logged in activity log
5. ✅ No errors in console or database

**Once these work, you're ready for production! 🚀**

---

## 📝 Notes Section

Use this space to record your test results:

**Test Job ID:** ___________________________

**Subcontractor:** ___________________________

**Assigned at:** ___________________________

**Deadline should be:** _______________ (should always be 3:30 PM ET)

**Timer showed:** ___________________________

**Issues found:** ___________________________

**Resolution:** ___________________________
