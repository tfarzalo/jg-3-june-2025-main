# CSV Export Enhancement - Testing Checklist

## Date: November 19, 2025

## Test Cases

### 1. Date Range Filtering
- [ ] **Test 1**: Export jobs with a 7-day range
  - Set start date: 7 days ago
  - Set end date: today
  - Expected: All jobs scheduled within this range are included
  
- [ ] **Test 2**: Export jobs for a single day
  - Set start date: specific day
  - Set end date: same day
  - Expected: All jobs scheduled on that day are included
  
- [ ] **Test 3**: Export jobs for last 30 days
  - Set start date: 30 days ago
  - Set end date: today
  - Expected: All jobs scheduled within this range are included
  
- [ ] **Test 4**: Verify more than 4 rows are exported
  - Use a date range that should include many jobs
  - Expected: All matching jobs are exported (not just 4)

### 2. Job Phase Filtering
- [ ] **Test 5**: Export all job phases
  - Select "All Job Phases" (default)
  - Expected: All jobs within date range, regardless of phase
  
- [ ] **Test 6**: Export only completed jobs
  - Select "Completed Jobs" phase
  - Expected: Only completed jobs within date range
  
- [ ] **Test 7**: Export specific phase
  - Select any other specific phase (e.g., "In Progress", "Job Request", etc.)
  - Expected: Only jobs in that phase within date range
  
- [ ] **Test 8**: Combined filtering
  - Set date range: last 14 days
  - Select phase: "Completed Jobs"
  - Expected: Only completed jobs from last 14 days

### 3. Removed Fields Verification
- [ ] **Test 9**: Check Job Information section
  - Open export modal
  - Expand Job Information section
  - Expected: The following fields should NOT appear:
    - Due Date
    - Amount
    - Status
    - Created By
    - Created At
    - Assigned To
    - Updated At

- [ ] **Test 10**: Verify export output
  - Export with all Job Information fields selected
  - Expected: CSV should not contain columns for removed fields

### 4. Export Modal UI
- [ ] **Test 11**: Modal opens with sections collapsed
  - Open export modal
  - Expected: All three sections (Job Information, Work Order Details, Billing/Invoice Information) are collapsed by default
  
- [ ] **Test 12**: Expand/collapse sections
  - Click section headers to expand
  - Click again to collapse
  - Expected: Sections expand and collapse smoothly
  
- [ ] **Test 13**: Job Phase selector appears
  - Open export modal
  - Expected: "Job Phase" dropdown appears between Date Range and Fields to Export
  - Expected: Default value is "All Job Phases"
  - Expected: All available phases are listed in dropdown

### 5. Field Selection
- [ ] **Test 14**: Select/Deselect individual fields
  - Expand each section
  - Check/uncheck individual fields
  - Expected: Fields are selected/deselected correctly
  
- [ ] **Test 15**: "Select All" button
  - Click "Select All" in each section
  - Expected: All fields in that section are checked
  
- [ ] **Test 16**: "Clear All" button
  - Click "Clear All" in each section
  - Expected: All fields in that section are unchecked
  
- [ ] **Test 17**: Field counter accuracy
  - Select/deselect fields in Job Information section
  - Expected: Counter shows correct number of selected fields (excluding work order and billing fields)

### 6. Billing Fields Export
- [ ] **Test 18**: Export with billing fields selected
  - Select all billing breakdown fields
  - Export jobs
  - Expected: All billing fields (Base, Additional Services, Extra Charges, Totals) are in CSV
  - Expected: Values match job details page
  
- [ ] **Test 19**: Jobs without billing data
  - Export jobs that don't have billing data yet
  - Expected: Shows "N/A" for missing data, "$0.00" for zero values

### 7. Console Logging
- [ ] **Test 20**: Check console output
  - Open browser console
  - Perform export
  - Expected: Console shows message like "Exporting X jobs out of Y total jobs"
  - Expected: X should match the filtered count based on date range and phase

### 8. Configuration Persistence
- [ ] **Test 21**: Settings saved across sessions
  - Change export settings
  - Close export modal
  - Reopen export modal
  - Expected: Previous settings are restored from localStorage
  
- [ ] **Test 22**: Phase selection persistence
  - Select a specific phase
  - Close and reopen modal
  - Expected: Selected phase should be remembered (if implemented in localStorage)

### 9. PDF Export
- [ ] **Test 23**: PDF export with phase filter
  - Select specific phase
  - Export as PDF
  - Expected: Only jobs matching phase and date range are in PDF
  
- [ ] **Test 24**: PDF with various field selections
  - Select different combinations of fields
  - Export as PDF
  - Expected: PDF includes only selected fields

### 10. Edge Cases
- [ ] **Test 25**: No jobs in date range
  - Set date range with no jobs
  - Expected: Empty CSV or appropriate message
  
- [ ] **Test 26**: Invalid date range (end before start)
  - Set end date before start date
  - Expected: Graceful handling (no export or warning)
  
- [ ] **Test 27**: Very large export
  - Set date range with 100+ jobs
  - Expected: All jobs export successfully without timeout
  
- [ ] **Test 28**: Jobs with invalid dates
  - Jobs with malformed scheduled_date
  - Expected: Console error logged, job excluded from export

## Success Criteria
- All date range tests pass with correct number of jobs
- Job phase filtering works for all phases
- Removed fields do not appear in UI or export
- Export modal sections start collapsed
- Console logging shows correct filtered job count
- Billing data exports match job details page
- No TypeScript errors or console errors during export

## Notes
- Test in both light and dark modes
- Test on different browsers (Chrome, Safari, Firefox)
- Verify mobile responsive design of export modal
- Check for memory leaks on large exports
