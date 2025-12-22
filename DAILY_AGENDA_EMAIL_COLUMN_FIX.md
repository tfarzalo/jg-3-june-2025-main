# Daily Agenda Email - Column Name Fix ✅

## Problem Found in Logs
```
Error fetching jobs: {
  code: "42703",
  message: "column jobs.work_order_number does not exist"
  hint: 'Perhaps you meant to reference the column "jobs.work_order_num".'
}
```

## Root Cause
The Edge Function was querying for `work_order_number`, but the actual column name in the database is `work_order_num`.

## Fix Applied
Changed all references from `work_order_number` to `work_order_num`:

### 1. Query Selection
```typescript
// Before
work_order_number,

// After
work_order_num,
```

### 2. Data Mapping
```typescript
// Before
work_order_number: job.work_order_number || 'N/A',

// After
work_order_number: job.work_order_num || 'N/A',
```

### 3. Debug Logging
```typescript
// Before
work_order: filteredJobs[0].work_order_number,

// After
work_order: filteredJobs[0].work_order_num,
```

## Function Status

### Active Functions
- ✅ **send-daily-agenda-email** (Version 8, Nov 23, 2025) - **CORRECT - USE THIS ONE**
- ⚠️ **daily-agenda-summary** (Version 11, Aug 30, 2025) - Old version, can be deleted

### Frontend Integration
The frontend correctly calls `send-daily-agenda-email`:
```typescript
await supabase.functions.invoke('send-daily-agenda-email', { ... })
```

## Test Now!

The function should now work correctly. Try these steps:

1. **Go to App Settings** → **Daily Agenda Email**
2. **Click "Send Test Email Now"**
3. **Check your email** - should show jobs for today (Nov 23, 2025)

## Expected Results

If jobs exist for today, the email should now show:
- ✅ Correct date: "Sunday, November 23, 2025"
- ✅ Job summary counts (Paint/Callback/Repair/Total)
- ✅ All job cards with:
  - Work Order Number (e.g., "WO-12345")
  - Property name
  - Unit number
  - Assigned to
  - Job type

## Function Logs

Check logs at: https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh/functions/send-daily-agenda-email/logs

You should now see:
```
Processing date (ET): 2025-11-23 (from 11/23/2025)
Querying jobs for date: 2025-11-23
Fetched X total non-cancelled jobs with scheduled dates
Found Y jobs for date 2025-11-23 (after ET date filtering)
```

No more errors about `work_order_number`!

## Cleanup (Optional)

The old `daily-agenda-summary` function can be deleted if it's no longer used:
```bash
supabase functions delete daily-agenda-summary
```

But verify first that nothing else is calling it.

---
**Fixed**: November 23, 2025 at 1:18 PM ET  
**Deployed**: Version 8  
**Status**: ✅ Ready to Test
