# 🔍 Countdown Timer Feature - Production Deployment Checklist

**Feature:** Subcontractor Assignment Countdown Timer  
**Deployed:** February 25, 2026  
**Git Commit:** `a7ea5af` - "feat: Add auto-decline feature with assignment deadlines and countdown timers"

---

## 📦 What This Feature Does

### For Subcontractors:
- Shows a **countdown timer** on their dashboard for jobs they've been assigned
- Timer counts down to **3:30 PM ET** deadline
- If they don't accept or decline by deadline, job is **auto-declined**
- Timer color changes based on urgency (green → yellow → red)

### For Admins:
- Shows countdown timer in **SubScheduler** for each assigned job
- Can see how much time subcontractors have to respond
- Visual indicator of assignment urgency

---

## ✅ Components Deployed (Confirmed in Code)

### 1. Frontend Components
- ✅ `src/components/AssignmentCountdownTimer.tsx` - Core countdown component
- ✅ `src/components/SubcontractorDashboard.tsx` - Integrated countdown (line 1111)
- ✅ `src/components/SubScheduler.tsx` - Integrated countdown (line 958)
- ✅ `src/utils/deadlineCalculations.ts` - Deadline calculation utilities

### 2. Database Functions (SQL Files)
- ✅ `add_assignment_deadline_columns.sql` - Adds columns to jobs table
- ✅ `create_assignment_deadline_functions.sql` - Creates DB functions
- ✅ `create_assignment_indexes.sql` - Performance indexes
- ✅ `grant_assignment_permissions.sql` - Permissions setup
- ✅ `fix_deadline_timezone.sql` - Timezone handling
- ✅ `add_assignment_email_notification.sql` - Email notifications
- ✅ `setup_auto_decline_cron_simple.sql` - Cron job setup
- ✅ `fix_pending_jobs_deadlines.sql` - Backfill existing jobs

### 3. Edge Function
- ✅ `supabase/functions/auto-decline-jobs/index.ts` - Auto-decline function

### 4. Build Verification
- ✅ Project builds successfully
- ✅ Component appears in build output: `AssignmentCountdownTimer-CcsVtHng.js`
- ✅ No TypeScript errors

---

## 🔍 What to Check on Production

### A. Frontend (Browser DevTools)

#### 1. Check if Component Loads
Open browser console and run:
```javascript
// Check if countdown timer component exists in the bundle
console.log('Countdown Timer:', window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== undefined);
```

#### 2. Network Tab - Check Bundle
- Look for `AssignmentCountdownTimer-*.js` in Network tab
- Verify file is loaded from production CDN
- Check file size matches build output (~2.80 kB)

#### 3. React DevTools
- Install React DevTools extension
- Navigate to SubcontractorDashboard
- Look for `<AssignmentCountdownTimer>` component in tree
- Check props: `deadline`, `size`, `language`, etc.

### B. Database (Supabase Dashboard)

#### 1. Check Columns Exist
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('assignment_deadline', 'assigned_at', 'assignment_status');
```

**Expected Result:**
- `assignment_deadline` - timestamp with time zone
- `assigned_at` - timestamp with time zone  
- `assignment_status` - text

#### 2. Check Database Functions Exist
```sql
SELECT proname 
FROM pg_proc 
WHERE proname IN (
  'calculate_assignment_deadline',
  'assign_job_to_subcontractor',
  'accept_job_assignment',
  'decline_job_assignment',
  'auto_decline_expired_assignments'
);
```

**Expected:** 5 functions returned

#### 3. Check Cron Job
```sql
SELECT * FROM cron.job WHERE jobname = 'auto-decline-expired-assignments';
```

**Expected:** 1 row with schedule `0 * * * *` (hourly at :00)

#### 4. Check if Jobs Have Deadlines
```sql
SELECT 
  COUNT(*) as total_pending,
  COUNT(assignment_deadline) as with_deadline,
  MAX(assignment_deadline AT TIME ZONE 'America/New_York') as latest_deadline
FROM jobs 
WHERE assignment_status = 'pending';
```

### C. Edge Function (Supabase Functions)

#### 1. Check Function Deployed
In Supabase Dashboard → Edge Functions:
- Look for `auto-decline-jobs` function
- Check deployment status
- Verify last deployed date

#### 2. Test Function Manually
```bash
curl -X POST https://[YOUR-PROJECT-REF].supabase.co/functions/v1/auto-decline-jobs \
  -H "Authorization: Bearer [YOUR-ANON-KEY]" \
  -H "Content-Type: application/json"
```

### D. Visual Checks

#### 1. Subcontractor Dashboard
- Log in as a subcontractor
- Look for countdown timer on assigned jobs
- Timer should show: "Time to Accept: [hours]h [minutes]m"
- Color should change based on urgency

#### 2. Admin SubScheduler
- Log in as admin
- Go to SubScheduler view
- Assigned jobs should show countdown timer
- Timer should be compact format in table

---

## 🚨 Common Issues & Solutions

### Issue 1: Timer Not Showing
**Symptoms:** No countdown timer visible on dashboard

**Possible Causes:**
1. **Build not deployed** - Old build still cached
   - Solution: Hard refresh (Cmd+Shift+R / Ctrl+Shift+R)
   - Check Network tab for `AssignmentCountdownTimer-*.js`

2. **Database columns missing** - Migrations not applied
   - Solution: Run SQL migrations in order (see Section B.1)

3. **No pending assignments** - No jobs with `assignment_status = 'pending'`
   - Solution: Assign a job to test

### Issue 2: Timer Shows Wrong Time
**Symptoms:** Timer countdown incorrect or shows negative time

**Possible Causes:**
1. **Timezone issue** - Deadline not in ET
   - Solution: Check `fix_deadline_timezone.sql` was applied
   - Verify: `SELECT assignment_deadline AT TIME ZONE 'America/New_York' FROM jobs WHERE assignment_status = 'pending';`

2. **Browser timezone mismatch**
   - Solution: Component uses server time, not browser time
   - Check deadline calculation function

### Issue 3: Auto-Decline Not Working
**Symptoms:** Jobs past deadline not auto-declining

**Possible Causes:**
1. **Cron job not enabled** - pg_cron extension missing
   - Solution: Run `CREATE EXTENSION IF NOT EXISTS pg_cron;`
   - Apply `setup_auto_decline_cron_simple.sql`

2. **Cron job not running**
   - Check: `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`
   - Look for execution history

3. **Function has errors**
   - Check: `SELECT * FROM cron.job_run_details WHERE status = 'failed';`
   - Review error messages

---

## 🎯 Quick Verification Steps

### 30-Second Check
1. ✅ Open production site as admin
2. ✅ Go to SubScheduler
3. ✅ Assign a job to a subcontractor
4. ✅ Look for countdown timer next to assignment
5. ✅ Log out and log in as that subcontractor
6. ✅ Check dashboard for countdown timer

### If Timer Doesn't Appear:
```sql
-- Check if job has deadline
SELECT 
  work_order_num,
  assigned_to,
  assignment_status,
  assignment_deadline,
  assignment_deadline AT TIME ZONE 'America/New_York' as deadline_et
FROM jobs 
WHERE work_order_num = [YOUR_TEST_JOB_NUMBER];
```

**Expected:**
- `assignment_status` = 'pending'
- `assignment_deadline` = timestamp in future
- `deadline_et` = today or tomorrow at 15:30:00 (3:30 PM)

---

## 📞 Support Information

### SQL Migrations to Apply (In Order)
If database changes are missing, apply these in order:

1. `add_assignment_deadline_columns.sql`
2. `create_assignment_deadline_functions.sql`
3. `create_assignment_indexes.sql`
4. `grant_assignment_permissions.sql`
5. `fix_deadline_timezone.sql`
6. `add_assignment_email_notification.sql`
7. `setup_auto_decline_cron_simple.sql`
8. `fix_pending_jobs_deadlines.sql`

### Edge Function Deployment
```bash
# Deploy auto-decline function
supabase functions deploy auto-decline-jobs
```

### Frontend Deployment
```bash
# Build and deploy
npm run build
# Deploy dist/ folder to hosting provider (Netlify/Vercel/etc.)
```

---

## 📊 Expected Behavior Summary

| View | What You Should See |
|------|-------------------|
| **Subcontractor Dashboard** | Countdown timer on each pending assigned job |
| **Admin SubScheduler** | Compact countdown timer in assignment column |
| **Job Assignment Email** | "Response Required by 3:30 PM ET" in subject |
| **Activity Log** | "assignment_accepted" or "assignment_declined" entries |
| **After Deadline** | Job status returns to 'unassigned', assigned_to cleared |

---

## 🔄 Rollback Plan (If Needed)

If feature is causing issues, you can temporarily disable:

### Disable Auto-Decline Cron
```sql
-- Disable the cron job
SELECT cron.unschedule('auto-decline-expired-assignments');
```

### Hide Timer (Frontend)
Comment out timer in components:
- `SubcontractorDashboard.tsx` line ~1111
- `SubScheduler.tsx` line ~958

### Full Rollback
```sql
-- Remove columns (WARNING: loses data)
ALTER TABLE jobs 
DROP COLUMN IF EXISTS assignment_deadline,
DROP COLUMN IF EXISTS assigned_at,
DROP COLUMN IF EXISTS assignment_status;
```

---

## ✅ Deployment Confirmation

**Person Who Deployed:** [Your Name]  
**Date:** February 25, 2026  
**Commit:** a7ea5af  
**Build Status:** ✅ Successful  
**Database Migrations:** [  ] Applied / [  ] Not Applied / [  ] Unknown  
**Edge Function:** [  ] Deployed / [  ] Not Deployed / [  ] Unknown  

**Production URL:** ___________________________  
**Tested By:** ___________________________  
**Date Verified:** ___________________________  

---

## 📝 Notes

_Add any deployment notes or issues encountered here:_

