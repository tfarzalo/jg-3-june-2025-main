# Calendar Jobs Display Fix - Verification Guide

## Issue Fixed
Jobs were not showing on the calendar when the "Events" filter was selected alongside job phases because the system was trying to query for "Events" as a job_phase in the database, which doesn't exist.

## Root Cause
The "Events" filter is a virtual phase added to allow filtering calendar events, but it was being included in database queries for job_phases, causing the query to fail or return no results.

## Fix Applied
1. Added filtering logic in `fetchJobs()` to exclude "Events" from the list of phases before querying the database
2. Added similar filtering logic in `updateDailyAgendaEvents()` 
3. Handled the case where only "Events" is selected (no job phases)

## Manual Testing Checklist

### Test Scenario 1: Default Behavior
- [ ] Open Calendar page
- [ ] Verify default filters are applied (Job Request, Work Order, Pending Work Order, Events)
- [ ] Verify jobs are visible on calendar dates
- [ ] Verify calendar events are visible on calendar dates
- [ ] Verify daily agenda totals are displayed correctly

### Test Scenario 2: Events Filter Only
- [ ] Click "Filter by Phase & Events" button
- [ ] Deselect all job phases, leaving only "Events" selected
- [ ] Verify only calendar events are shown (no jobs)
- [ ] Verify no errors in console

### Test Scenario 3: Job Phases Only
- [ ] Click "Filter by Phase & Events" button
- [ ] Deselect "Events", select one or more job phases
- [ ] Verify jobs matching selected phases are displayed
- [ ] Verify calendar events are hidden
- [ ] Verify daily agenda totals reflect only filtered jobs

### Test Scenario 4: Mixed Filters
- [ ] Click "Filter by Phase & Events" button
- [ ] Select "Events" AND one or more job phases (e.g., "Work Order", "Job Request")
- [ ] **This should now work!** Verify both jobs and events are displayed
- [ ] Verify jobs match the selected phases
- [ ] Verify calendar events are visible
- [ ] Verify no console errors

### Test Scenario 5: Clear Filters
- [ ] Apply various filters
- [ ] Click "Clear" button
- [ ] Verify calendar returns to showing no filters (empty state)
- [ ] Verify jobs and events load correctly

### Test Scenario 6: Month Navigation
- [ ] Navigate to different months using arrow buttons
- [ ] Verify jobs and events load correctly for each month
- [ ] Verify daily agenda totals update correctly
- [ ] Verify filters persist across month changes

### Test Scenario 7: Realtime Updates
- [ ] Open calendar in one browser tab
- [ ] Create/edit/delete a job in another tab (with scheduled date visible in calendar)
- [ ] Verify calendar updates automatically to reflect changes
- [ ] Verify daily agenda totals update automatically

## Expected Results
- All scenarios should work without errors
- Jobs should display on calendar when job phases are selected
- Events should display when "Events" is selected
- Both jobs and events should display when mixed filters are selected
- No console errors related to database queries
- Daily agenda totals should calculate correctly

## Console Checks
Open browser console and verify:
- [ ] No errors like "Failed to fetch jobs" or similar
- [ ] No database query errors
- [ ] Jobs fetch successfully with appropriate filters
- [ ] Events fetch successfully

## Notes
- The fix ensures that "Events" is filtered out before database queries
- When only "Events" is selected, the system doesn't attempt to fetch jobs
- When both events and job phases are selected, both types of data are fetched correctly
