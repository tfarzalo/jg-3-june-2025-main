# 🎯 Assignment Deadline Feature - Quick Start Guide

## 📋 SQL Files to Run (IN ORDER)

Execute these SQL files in your Supabase SQL Editor or via command line:

### 1️⃣ First: Add Columns
```
File: add_assignment_deadline_columns.sql
Purpose: Adds assigned_at, assignment_deadline, and assignment_status columns to jobs table
```

### 2️⃣ Second: Create Functions
```
File: create_assignment_deadline_functions.sql
Purpose: Creates 5 database functions for assignment management
  - calculate_assignment_deadline()
  - assign_job_to_subcontractor()
  - accept_job_assignment()
  - decline_job_assignment()
  - auto_decline_expired_assignments()
```

### 3️⃣ Third: Create Indexes
```
File: create_assignment_indexes.sql
Purpose: Creates 4 performance indexes for fast queries
```

### 4️⃣ Fourth: Grant Permissions
```
File: grant_assignment_permissions.sql
Purpose: Grants execute permissions to authenticated users and service_role
```

---

## 🚀 Quick Deployment Commands

### Run SQL Files (via Supabase Dashboard)
1. Open Supabase Dashboard → SQL Editor
2. Copy/paste each file content in order
3. Click "Run" for each file

### Deploy Edge Function
```bash
cd /Users/timothyfarzalo/Desktop/jg-january-2026
supabase functions deploy auto-decline-jobs
```

### Deploy Frontend
```bash
npm run build
# Then deploy to your hosting service (Vercel, Netlify, etc.)
```

---

## ✅ Verification Checklist

After running SQL files, verify in Supabase SQL Editor:

```sql
-- Check columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'jobs' AND column_name LIKE '%assignment%';
-- Should return: assigned_at, assignment_deadline, assignment_status

-- Check functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_name LIKE '%assignment%';
-- Should return 5 functions

-- Check indexes exist
SELECT indexname FROM pg_indexes 
WHERE tablename = 'jobs' AND indexname LIKE '%assignment%';
-- Should return 4 indexes

-- Test deadline calculation
SELECT calculate_assignment_deadline(NOW());
-- Should return a timestamp for 3:30 PM ET today (or next business day)
```

---

## 📁 Files Created/Modified

### New Files:
- ✅ `add_assignment_deadline_columns.sql`
- ✅ `create_assignment_deadline_functions.sql`
- ✅ `create_assignment_indexes.sql`
- ✅ `grant_assignment_permissions.sql`
- ✅ `src/utils/deadlineCalculations.ts`
- ✅ `src/components/AssignmentCountdownTimer.tsx`
- ✅ `supabase/functions/auto-decline-jobs/index.ts`
- ✅ `ASSIGNMENT_DEADLINE_DEPLOYMENT_GUIDE.md`

### Modified Files:
- ✅ `src/components/SubcontractorDashboard.tsx`

---

## 🎯 What This Feature Does

1. **Deadline Rule**: Jobs must be accepted/declined by 3:30 PM ET on the day assigned
2. **Countdown Timer**: Shows time remaining on subcontractor dashboard
3. **Auto-Decline**: Jobs not responded to by deadline are auto-declined
4. **Activity Logging**: All actions logged (assign, accept, decline, auto-decline)
5. **Real-time Updates**: Dashboard updates automatically when jobs change

---

## ⚠️ Important Notes

- **Timezone**: All deadlines are in Eastern Time (America/New_York)
- **Weekend Handling**: Jobs assigned after 3:30 PM Friday → Monday 3:30 PM deadline
- **Cron Frequency**: Auto-decline runs every 5 minutes
- **Backwards Compatible**: Existing assigned jobs automatically marked as 'accepted'

---

## 🔄 Next Steps After Deployment

1. Monitor edge function logs for auto-declines
2. Watch for jobs with approaching deadlines
3. Communicate new feature to subcontractors
4. Track auto-decline rates and response times

---

## 📞 Support

For issues or questions:
- Check `ASSIGNMENT_DEADLINE_DEPLOYMENT_GUIDE.md` for detailed troubleshooting
- Review edge function logs in Supabase Dashboard → Edge Functions
- Check job_activity_logs table for assignment history

---

## ✨ Feature Summary

**Before**: Jobs could sit unresponded indefinitely
**After**: 3:30 PM ET deadline ensures quick responses and returns unaccepted jobs to pool

**Impact**: Faster job assignment, clearer expectations, better workflow efficiency
