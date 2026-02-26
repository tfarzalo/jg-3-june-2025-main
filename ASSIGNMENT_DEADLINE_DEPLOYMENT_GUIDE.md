# Assignment Deadline Feature - Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying the auto-decline feature with 3:30 PM ET deadlines.

---

## ✅ Pre-Deployment Checklist

- [ ] Backup database before running migrations
- [ ] Verify Supabase project is accessible
- [ ] Confirm you have admin/service role access
- [ ] Review all SQL files before execution
- [ ] Test in development/staging environment first

---

## 📋 SQL Files Execution Order

### Step 1: Add Database Columns
**File:** `add_assignment_deadline_columns.sql`
**Purpose:** Adds new columns to jobs table for tracking assignment deadlines

```bash
# Run in Supabase SQL Editor or via psql
psql -h [your-db-host] -d [your-db] -f add_assignment_deadline_columns.sql
```

**What it does:**
- Adds `assigned_at` column (timestamp when job was assigned)
- Adds `assignment_deadline` column (3:30 PM ET deadline)
- Adds `assignment_status` column (pending/accepted/declined/auto_declined)
- Sets existing assigned jobs to 'accepted' status
- Adds check constraint for valid statuses

**Verification:**
```sql
-- Should show new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name LIKE '%assignment%';
```

---

### Step 2: Create Database Functions
**File:** `create_assignment_deadline_functions.sql`
**Purpose:** Creates all functions for assignment deadline management

```bash
psql -h [your-db-host] -d [your-db] -f create_assignment_deadline_functions.sql
```

**What it does:**
- Creates `calculate_assignment_deadline()` - Calculates 3:30 PM ET deadline
- Creates `assign_job_to_subcontractor()` - Assigns job with deadline
- Creates `accept_job_assignment()` - Subcontractor accepts job
- Creates `decline_job_assignment()` - Subcontractor declines job
- Creates `auto_decline_expired_assignments()` - Auto-declines expired jobs

**Verification:**
```sql
-- Should show 5 new functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE '%assignment%';

-- Test deadline calculation
SELECT calculate_assignment_deadline(NOW());
```

---

### Step 3: Create Performance Indexes
**File:** `create_assignment_indexes.sql`
**Purpose:** Creates indexes to optimize queries

```bash
psql -h [your-db-host] -d [your-db] -f create_assignment_indexes.sql
```

**What it does:**
- Creates index on `assignment_deadline` for pending jobs
- Creates index on `assignment_status`
- Creates compound index on `assigned_to` + `assignment_status`
- Creates index on `assigned_at` for reporting

**Verification:**
```sql
-- Should show 4 new indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'jobs'
AND indexname LIKE '%assignment%';
```

---

### Step 4: Grant Permissions
**File:** `grant_assignment_permissions.sql`
**Purpose:** Grants necessary permissions to users and service role

```bash
psql -h [your-db-host] -d [your-db] -f grant_assignment_permissions.sql
```

**What it does:**
- Grants execute permissions on functions to authenticated users
- Grants execute permission on auto-decline to service_role only

**Verification:**
```sql
-- Should show permissions for each function
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
AND routine_name LIKE '%assignment%';
```

---

## 🚀 Deploy Edge Function

### Step 1: Install Supabase CLI (if not already installed)
```bash
npm install -g supabase
```

### Step 2: Login to Supabase
```bash
supabase login
```

### Step 3: Link to Your Project
```bash
supabase link --project-ref [your-project-ref]
```

### Step 4: Deploy Edge Function
```bash
supabase functions deploy auto-decline-jobs
```

### Step 5: Verify Deployment
```bash
# Test the function manually
curl -X POST \
  https://[your-project-ref].supabase.co/functions/v1/auto-decline-jobs \
  -H "Authorization: Bearer [your-anon-key]" \
  -H "Content-Type: application/json"
```

---

## ⏰ Set Up Cron Job

### Option 1: GitHub Actions (Recommended)

Create `.github/workflows/auto-decline-jobs.yml`:

```yaml
name: Auto-Decline Expired Job Assignments

on:
  schedule:
    # Run every 5 minutes
    - cron: '*/5 * * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  auto-decline:
    runs-on: ubuntu-latest
    steps:
      - name: Call auto-decline edge function
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            https://${{ secrets.SUPABASE_PROJECT_REF }}.supabase.co/functions/v1/auto-decline-jobs
```

**Setup GitHub Secrets:**
1. Go to repository Settings → Secrets and variables → Actions
2. Add `SUPABASE_SERVICE_ROLE_KEY`
3. Add `SUPABASE_PROJECT_REF`

### Option 2: Supabase Cron (if available)

```sql
SELECT cron.schedule(
  'auto-decline-expired-assignments',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url:='https://[your-project-ref].supabase.co/functions/v1/auto-decline-jobs',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer [service-role-key]"}'::jsonb
  ) as request_id;
  $$
);
```

### Option 3: External Cron Service (Cron-job.org, EasyCron, etc.)

Configure to hit:
```
POST https://[your-project-ref].supabase.co/functions/v1/auto-decline-jobs
Headers:
  Authorization: Bearer [service-role-key]
  Content-Type: application/json
```

---

## 🎨 Deploy Frontend Changes

### Files Changed:
1. `src/utils/deadlineCalculations.ts` (NEW)
2. `src/components/AssignmentCountdownTimer.tsx` (NEW)
3. `src/components/SubcontractorDashboard.tsx` (UPDATED)

### Deployment Steps:

```bash
# 1. Build the frontend
npm run build

# 2. Deploy to your hosting service
# For Vercel:
vercel --prod

# For Netlify:
netlify deploy --prod

# For other services, follow their deployment process
```

---

## 🧪 Testing Checklist

### Database Testing
- [ ] Run all SQL files in order without errors
- [ ] Verify new columns exist in jobs table
- [ ] Verify all 5 functions exist
- [ ] Verify all 4 indexes exist
- [ ] Test `calculate_assignment_deadline()` with various times
- [ ] Test assigning a job (should set deadline)
- [ ] Test accepting a job (should clear deadline)
- [ ] Test declining a job (should clear assignment)

### Edge Function Testing
- [ ] Edge function deploys successfully
- [ ] Manual test call returns success
- [ ] Check function logs in Supabase dashboard
- [ ] Verify auto-decline function finds expired jobs
- [ ] Verify activity logs are created

### Frontend Testing
- [ ] Countdown timer appears on pending assignments
- [ ] Timer updates every second
- [ ] Timer changes color (green → yellow → orange → red)
- [ ] Timer shows "EXPIRED" when deadline passes
- [ ] Accept button works and clears timer
- [ ] Decline button works and removes job
- [ ] Real-time updates work (job disappears when auto-declined)
- [ ] Spanish translations work correctly

### Integration Testing
- [ ] Assign job at 9:00 AM → Deadline is 3:30 PM same day
- [ ] Assign job at 3:15 PM → Deadline is 3:30 PM same day (15 min)
- [ ] Assign job at 3:35 PM → Deadline is 3:30 PM next business day
- [ ] Assign job on Friday 5 PM → Deadline is Monday 3:30 PM
- [ ] Job auto-declines at 3:30 PM if not accepted
- [ ] Activity log shows all assignment actions
- [ ] Dashboard updates in real-time when job auto-declined

---

## 📊 Monitoring

### Check Auto-Decline Logs
```sql
-- View recent auto-declines
SELECT 
  jal.created_at,
  j.work_order_num,
  jal.description,
  p.property_name
FROM job_activity_logs jal
JOIN jobs j ON jal.job_id = j.id
LEFT JOIN properties p ON j.property_id = p.id
WHERE jal.action = 'assignment_auto_declined'
ORDER BY jal.created_at DESC
LIMIT 20;
```

### Check Pending Jobs with Approaching Deadlines
```sql
-- Jobs expiring in next hour
SELECT 
  j.work_order_num,
  j.assignment_deadline,
  j.assignment_deadline - NOW() as time_remaining,
  p.full_name as subcontractor,
  prop.property_name
FROM jobs j
LEFT JOIN profiles p ON j.assigned_to = p.id
LEFT JOIN properties prop ON j.property_id = prop.id
WHERE j.assignment_status = 'pending'
AND j.assignment_deadline < NOW() + INTERVAL '1 hour'
ORDER BY j.assignment_deadline ASC;
```

### Check Auto-Decline Statistics
```sql
-- Auto-decline stats by day
SELECT 
  DATE(jal.created_at) as date,
  COUNT(*) as auto_declined_count,
  STRING_AGG(DISTINCT p.full_name, ', ') as subcontractors
FROM job_activity_logs jal
LEFT JOIN profiles p ON jal.user_id = p.id
WHERE jal.action = 'assignment_auto_declined'
AND jal.created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(jal.created_at)
ORDER BY date DESC;
```

---

## 🔧 Troubleshooting

### Issue: Auto-decline not running
**Solution:**
- Check cron job is configured correctly
- Verify edge function is deployed
- Check edge function logs for errors
- Verify service role key is correct

### Issue: Countdown timer not showing
**Solution:**
- Check job has `assignment_status = 'pending'`
- Check job has `assignment_deadline` set
- Verify component is imported correctly
- Check browser console for errors

### Issue: Deadline calculated incorrectly
**Solution:**
- Verify timezone is 'America/New_York'
- Check DST handling
- Test `calculate_assignment_deadline()` function manually

### Issue: Jobs not auto-declining
**Solution:**
- Check edge function logs
- Verify `auto_decline_expired_assignments()` function exists
- Check permissions on function
- Verify cron job is triggering edge function

---

## 📧 Communicate to Team

### Email Template for Subcontractors:

**Subject:** New Feature: Job Assignment Deadline

Dear [Subcontractor Name],

We've implemented a new feature to improve job assignment efficiency:

**NEW DEADLINE POLICY:**
When a job is assigned to you, you must accept or decline it by **3:30 PM Eastern Time on the same day** the assignment is made.

**COUNTDOWN TIMER:**
You'll see a countdown timer on your dashboard showing exactly how much time you have left to respond.

**AUTO-DECLINE:**
If you don't respond by 3:30 PM ET, the job will be automatically declined and returned to the unassigned pool.

**EXAMPLES:**
- Assigned at 9:00 AM → Respond by 3:30 PM same day
- Assigned at 2:45 PM → Respond by 3:30 PM same day (45 minutes)
- Assigned at 4:00 PM → Respond by 3:30 PM next business day

Please log in to your dashboard to see the new countdown timers.

Best regards,
[Your Team]

---

## ✅ Deployment Complete!

After completing all steps:

1. ✅ Database columns added
2. ✅ Functions created
3. ✅ Indexes created
4. ✅ Permissions granted
5. ✅ Edge function deployed
6. ✅ Cron job configured
7. ✅ Frontend deployed
8. ✅ Testing completed
9. ✅ Team notified

**Monitor for 24-48 hours to ensure everything works smoothly!**
