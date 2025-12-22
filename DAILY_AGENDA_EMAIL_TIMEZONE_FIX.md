# Daily Agenda Email - Timezone Fix

## Problem Identified
The daily agenda email was not pulling jobs scheduled for the current day. The email showed "No jobs scheduled for this day" even when jobs existed.

## Root Cause
The issue was related to **timezone handling** in the date comparison logic:

1. The `scheduled_date` field in the database is stored as `timestamptz` (timestamp with timezone)
2. The original query was creating Date objects in the local server timezone (UTC) and comparing them with timestamps that may have been stored in ET timezone
3. This mismatch caused the date range filters to miss jobs scheduled for the target day

### Original (Broken) Code:
```typescript
const startOfDay = new Date(date);
startOfDay.setHours(0, 0, 0, 0);

const endOfDay = new Date(date);
endOfDay.setHours(23, 59, 59, 999);

.gte('scheduled_date', startOfDay.toISOString())
.lte('scheduled_date', endOfDay.toISOString())
```

This approach created timestamps in UTC, which didn't properly match jobs stored with ET timezone information.

## Solution Implemented

### New Approach: Client-Side Timezone-Aware Filtering

1. **Fetch all non-cancelled jobs** from the database (no date filtering on query)
2. **Filter on the client side** using proper timezone conversion
3. **Compare date components only** (year, month, day) in ET timezone

### New (Fixed) Code:
```typescript
async function getJobsForDate(date: string): Promise<JobData[]> {
  // Fetch all jobs (unfiltered by date)
  const { data, error } = await supabase
    .from('jobs')
    .select(`...`)
    .filter('scheduled_date', 'not.is', null)
    .not('status', 'eq', 'Cancelled')
    .order('scheduled_date', { ascending: true });
  
  // Filter to match target date in ET timezone
  const targetDate = new Date(date + 'T00:00:00-05:00');
  const filteredJobs = (data || []).filter((job: any) => {
    const jobDate = new Date(job.scheduled_date);
    const jobDateET = new Date(jobDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const targetDateET = new Date(targetDate.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    
    return (
      jobDateET.getFullYear() === targetDateET.getFullYear() &&
      jobDateET.getMonth() === targetDateET.getMonth() &&
      jobDateET.getDate() === targetDateET.getDate()
    );
  });
  
  return filteredJobs;
}
```

## Benefits of This Approach

✅ **Always accurate**: Properly handles timezone conversion to ET  
✅ **No cache issues**: Fetches fresh data every time  
✅ **Robust**: Works regardless of how timestamps are stored in the database  
✅ **Transparent**: Added detailed logging to track job counts and filtering  

## Verification Steps

After deployment, test the email:

1. Go to **App Settings** > **Daily Agenda Email**
2. Click **"Send Test Email Now"**
3. Check your email - it should now show all jobs scheduled for today

## Deployment Status

✅ **Deployed**: November 23, 2025  
✅ **Function**: `send-daily-agenda-email`  
✅ **Project**: tbwtfimnbmvbgesidbxh  

## Enhanced Logging

The updated function now includes detailed logging:
- Total jobs fetched from database
- Number of jobs after date filtering
- Sample job data for debugging
- Timezone information in email footer

Check the function logs in the Supabase Dashboard for troubleshooting.

## Notes

- The function still pulls **fresh, real-time data** at send time
- No caching or pre-computation is used
- Email accurately reflects the job schedule at the exact moment it's sent
- Works for both test emails and scheduled 5 AM ET sends
