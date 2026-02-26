# Is Unit Occupied Field Implementation

## Date: February 25, 2026

## Summary
Added "Is Unit Occupied?" dropdown field to the job request form. The occupancy status set during job creation automatically populates the work order form and is displayed in job details.

## Changes Made

### 1. Database Schema Updates

#### Migration 1: Add is_occupied to jobs table
**File:** `20260225000003_add_is_occupied_to_jobs.sql`
- Added `is_occupied` boolean column to `jobs` table (defaults to `false`)
- Added documentation comment

#### Migration 2: Update create_job function
**File:** `20260225000004_update_create_job_with_is_occupied.sql`
- Added `p_is_occupied` parameter to `create_job()` RPC function
- Function now accepts and stores occupancy status
- Returns `is_occupied` in the job details response

#### Migration 3: Update get_job_details function
**File:** `20260225000005_update_get_job_details_with_is_occupied.sql`
- Updated `get_job_details()` to return `is_occupied` from jobs table
- Maintains consistency across job details queries

### 2. Frontend Updates

#### JobRequestForm.tsx
**Changes:**
1. Added `is_occupied: false` to formData state
2. Added dropdown field in the form UI
3. Updated `create_job` RPC call to pass `p_is_occupied` parameter

**UI Code:**
```typescript
<div>
  <label htmlFor="is_occupied" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
    Is Unit Occupied?
  </label>
  <select
    id="is_occupied"
    name="is_occupied"
    value={formData.is_occupied ? 'yes' : 'no'}
    onChange={(e) => setFormData(prev => ({ ...prev, is_occupied: e.target.value === 'yes' }))}
    className="w-full h-11 px-4 bg-gray-50 dark:bg-[#0F172A] border border-gray-300 dark:border-[#2D3B4E] rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
  >
    <option value="no">No</option>
    <option value="yes">Yes</option>
  </select>
</div>
```

#### NewWorkOrder.tsx
**No changes needed** - Already reads `is_occupied` from job and displays as checkbox

## Data Flow

### 1. Job Request Creation
```
User selects "Is Unit Occupied?" (Yes/No)
  ↓
JobRequestForm submits with is_occupied value
  ↓
create_job() RPC stores value in jobs.is_occupied
  ↓
Job created with occupancy status
```

### 2. Work Order Form Load
```
User opens work order form for job
  ↓
NewWorkOrder.tsx fetches job details
  ↓
job.is_occupied populates formData.is_occupied
  ↓
Checkbox "Unit is Occupied" reflects job's occupancy status
```

### 3. Job Details Display
```
User views job details
  ↓
get_job_details() returns is_occupied from jobs table
  ↓
JobDetails.tsx displays occupancy status
```

## Field Placement

The "Is Unit Occupied?" field is placed in the "Job Details" section, after the "Purchase Order (PO#)" field and before the "Job Type" field.

## Behavior

### Job Request Form
- **Default Value:** No (unchecked/false)
- **Options:** 
  - No (default)
  - Yes
- **Required:** No (optional field)

### Work Order Form
- **Auto-populated:** Checkbox reflects value from job request
- **User can override:** Yes - subcontractor can change if needed
- **Saved separately:** Work order maintains its own is_occupied value

### Job Details
- **Display:** Shows occupancy status from job record
- **Work Order Override:** If work order exists, its value takes precedence

## Consistency with Other Fields

The new dropdown matches the styling and behavior of other select fields:
- Same height (h-11)
- Same padding (px-4)
- Same border styling
- Same focus ring
- Same dark mode support
- Yes/No options (consistent with other boolean dropdowns)

## Database Schema

### jobs table
```sql
is_occupied boolean DEFAULT false
```

### work_orders table
```sql
is_occupied boolean NOT NULL DEFAULT false
```

Both tables store occupancy status independently, allowing work orders to have different values if needed (e.g., unit becomes occupied after job request).

## Testing Scenarios

### Test Case 1: Create Job with Occupied Unit
1. Create job request
2. Select "Is Unit Occupied?" = **Yes**
3. Submit job request
4. Open work order form
5. ✅ Verify "Unit is Occupied" checkbox is **checked**

### Test Case 2: Create Job with Unoccupied Unit
1. Create job request
2. Select "Is Unit Occupied?" = **No** (default)
3. Submit job request
4. Open work order form
5. ✅ Verify "Unit is Occupied" checkbox is **unchecked**

### Test Case 3: Override in Work Order
1. Create job with occupied = No
2. Open work order form (checkbox unchecked)
3. Manually check "Unit is Occupied"
4. Save work order
5. ✅ Verify work order saves with is_occupied = true

### Test Case 4: View Job Details
1. Create job with occupied = Yes
2. View job details page
3. ✅ Verify job details shows is_occupied = true
4. Create work order with occupied = No override
5. View job details again
6. ✅ Verify work order section shows is_occupied = false

## Migration Order

Migrations must be applied in order:
1. `20260225000003` - Add column to jobs table
2. `20260225000004` - Update create_job function
3. `20260225000005` - Update get_job_details function

## Backward Compatibility

- ✅ **Existing Jobs:** Default to `is_occupied = false`
- ✅ **Existing Work Orders:** Keep their own `is_occupied` values
- ✅ **No Breaking Changes:** All existing functionality preserved
- ✅ **Optional Field:** Job requests can be created without setting this value

## Benefits

1. **Upfront Information:** Occupancy status known at job creation
2. **Auto-Population:** Work order form pre-filled correctly
3. **Consistency:** Same value flows through system unless overridden
4. **Flexibility:** Can be changed at work order level if needed
5. **Better Planning:** Teams know unit occupancy before visiting

## Files Modified

### Database Migrations (3 files)
- `supabase/migrations/20260225000003_add_is_occupied_to_jobs.sql`
- `supabase/migrations/20260225000004_update_create_job_with_is_occupied.sql`
- `supabase/migrations/20260225000005_update_get_job_details_with_is_occupied.sql`

### Frontend Components (1 file)
- `src/components/JobRequestForm.tsx`

### No Changes Required
- `src/components/NewWorkOrder.tsx` (already compatible)
- `src/components/JobDetails.tsx` (already compatible)

## Status
✅ **COMPLETE** - Ready for testing
