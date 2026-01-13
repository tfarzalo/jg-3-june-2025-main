# Export All Jobs - Limit Fix

## Issue
When exporting jobs from the Job Requests page (or any other page), only 4 jobs were being exported instead of all jobs matching the filter criteria. The network request showed only 4 records being fetched from the database.

## Root Cause
The Supabase query in the `exportToCSV` function was not explicitly setting a limit, which caused it to potentially use a restrictive default or some other limitation was being applied.

## Solution
Added an explicit `.limit(10000)` and better logging to the jobs fetch query in `exportToCSV`:

```typescript
const { data: jobsData, error: jobsError, count } = await supabase
  .from('jobs')
  .select(`
    // ... all fields
  `, { count: 'exact' })
  .in('current_phase_id', phaseIds)
  .order('created_at', { ascending: false })
  .limit(10000); // Explicit high limit to ensure we get all jobs

console.log(`Database returned ${jobsData?.length || 0} jobs out of ${count} total for phase IDs:`, phaseIds);
```

## Changes Made
1. **Added explicit limit**: Set `.limit(10000)` to ensure all jobs are fetched (up to 10,000)
2. **Added count parameter**: Added `{ count: 'exact' }` to get total count for debugging
3. **Enhanced logging**: 
   - Log phase IDs being queried
   - Log actual vs total record count
   - Better visibility into what's being fetched

## Files Modified
- `src/components/shared/JobListingPage.tsx` (lines 455-496)

## Testing
1. Navigate to Job Requests page
2. Click Export button
3. Open browser console to see:
   - Phase IDs being queried
   - Number of jobs returned vs total available
4. Verify that ALL jobs matching the date range are exported (not just 4)

## Expected Behavior
- Export should fetch all jobs for the current phase(s)
- Console should show: `Database returned X jobs out of Y total for phase IDs: [...]`
- CSV export should include all filtered jobs, not just a limited subset
- Date range filter should still apply correctly

## Notes
- The 10,000 limit is a safeguard; if you need more, increase this value
- Supabase's default behavior can vary; explicit limits are best practice
- The count parameter helps diagnose if there are more records than being returned
- Phase filtering happens at the database level for efficiency
