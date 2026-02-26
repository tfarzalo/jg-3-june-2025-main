# Full Paint Auto-Set Implementation

## Date: February 25, 2026

## Summary
Implemented automatic setting of the "Full Paint" field in the work order form based on the **job type** selected in the job request form:
- **"Paint" job type** → "Full Paint" = Yes (checked)
- **"Repair" or "Callback" job types** → "Full Paint" = No (unchecked)

## Requirements Analysis

### Requirement
When a new job request is submitted:
- If job type = "Paint" → work order form should have "Full Paint" = Yes (checked)
- If job type = "Repair" or "Callback" → work order form should have "Full Paint" = No (unchecked)

### System Architecture Analysis

#### Job Creation Flow
1. **JobRequestForm.tsx** - Creates new job requests
   - Allows user to select job category (e.g., "Regular Paint", "Color Change", etc.)
   - Calls `create_job` RPC function in Supabase
   - Does NOT create a work order at this stage

2. **Job Phase "Job Request"**
   - Jobs start in "Job Request" phase after creation
   - Wait for subcontractor to fill out work order form

3. **NewWorkOrder.tsx** - Work order form filled by subcontractors
   - Fetches job details including job category
   - Has `is_full_paint` boolean field (Yes/No checkbox)
   - Creates work order and advances job phase

#### Database Schema
- **jobs table**: Has `job_type_id` (FK to job_types)
- **job_types table**: Contains types like "Paint", "Repair", "Callback", etc.
- **work_orders table**: Has `is_full_paint` boolean field (defaults to false)

## Implementation Details

### Changes Made

#### 1. Updated useEffect Logic (NewWorkOrder.tsx)
Added job type detection and conditional auto-set logic when initializing the work order form:

```typescript
useEffect(() => {
  // ...existing work order check...
  
  } else if (job) {
    // Check job type to auto-set is_full_paint:
    // - "Paint" job type -> is_full_paint = true (Yes)
    // - "Repair" or "Callback" job type -> is_full_paint = false (No)
    const jobTypeLabel = job.job_type?.job_type_label?.toLowerCase() || '';
    const isPaintJob = jobTypeLabel === 'paint';
    const isRepairOrCallback = jobTypeLabel === 'repair' || jobTypeLabel === 'callback';
    
    // Auto-set is_full_paint based on job type
    let autoSetFullPaint = job.is_full_paint ?? false;
    if (isPaintJob) {
      autoSetFullPaint = true;
    } else if (isRepairOrCallback) {
      autoSetFullPaint = false;
    }
    
    setFormData({
      // ...other fields...
      is_full_paint: autoSetFullPaint,
      // ...remaining fields...
    });
  }
}, [existingWorkOrder, job]);
```

## Behavior

### When Creating a New Work Order

1. **Job Type = "Paint"**
   - Work order form loads with "Full Paint" checkbox **automatically checked (Yes)**
   - User can still manually uncheck if needed

2. **Job Type = "Repair"**
   - Work order form loads with "Full Paint" checkbox **unchecked (No)**
   - User can manually check if needed

3. **Job Type = "Callback"**
   - Work order form loads with "Full Paint" checkbox **unchecked (No)**
   - User can manually check if needed

4. **Existing Work Orders**
   - When editing an existing work order, the saved value is preserved
   - Auto-set logic only applies when creating a NEW work order

## Testing Scenarios

### Test Case 1: Paint Job Type
1. Create job request with job type "Paint"
2. Navigate to work order form
3. **Expected**: "Full Paint" checkbox is checked by default

### Test Case 2: Repair Job Type
1. Create job request with job type "Repair"
2. Navigate to work order form
3. **Expected**: "Full Paint" checkbox is unchecked

### Test Case 3: Callback Job Type
1. Create job request with job type "Callback"
2. Navigate to work order form
3. **Expected**: "Full Paint" checkbox is unchecked

### Test Case 4: Editing Existing Work Order
1. Open existing work order (regardless of job type)
2. **Expected**: "Full Paint" value matches what was previously saved

### Test Case 5: Manual Override
1. Create work order for "Paint" job (checkbox auto-checked)
2. Manually uncheck the "Full Paint" checkbox
3. Save work order
4. **Expected**: Work order saves with "Full Paint" = No

## Files Modified

1. **src/components/NewWorkOrder.tsx**
   - Updated `useEffect` for formData initialization
   - Added job type detection logic
   - Added conditional auto-set logic for `is_full_paint`

## No Database Changes Required

This implementation does NOT require any database migrations because:
- The `work_orders.is_full_paint` field already exists
- The `jobs.job_type_id` field already exists
- The `job_types` table already exists with the required job types
- We're only adding client-side logic to auto-populate the form

## Conditional Logic Summary

```
IF (creating new work order) AND (job.job_type.job_type_label === 'Paint')
  THEN is_full_paint = true
ELSE IF (creating new work order) AND (job.job_type.job_type_label === 'Repair' OR 'Callback')
  THEN is_full_paint = false
ELSE IF (editing existing work order)
  THEN is_full_paint = existingWorkOrder.is_full_paint
ELSE
  THEN is_full_paint = false (default)
```

## Additional Notes

- The auto-set behavior is **non-destructive** - users can always manually change the value
- The logic only applies to NEW work orders; existing work orders retain their saved values
- The implementation respects the existing work order editing flow
- No changes needed to JobRequestForm or database schema
- The feature is backward compatible with existing jobs and work orders

## Future Enhancements (Optional)

1. Could add similar auto-set logic for other job categories
2. Could make the auto-set rules configurable per property
3. Could add visual indicator showing why a field was auto-checked
4. Could track whether auto-set values were manually changed for analytics
