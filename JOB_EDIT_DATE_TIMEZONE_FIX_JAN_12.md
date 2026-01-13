# Job Edit Form Date Timezone Fix - January 12, 2026

## Problem
When updating a job's scheduled date, the date was being saved incorrectly due to timezone conversion:
- **Example**: Selecting January 12th would save as January 11th
- **Root Cause**: Timezone conversion between local time and Eastern Time was causing off-by-one day errors

## Solution

### 1. Fixed `formatDateForInput()` in dateUtils.ts
**Location**: `src/lib/dateUtils.ts`

**Changes**:
- Added logic to handle dates as pure date strings (YYYY-MM-DD) without timezone conversion
- Checks if date is already in YYYY-MM-DD format and returns it as-is
- Extracts date portion from ISO strings (before the 'T')
- Prevents timezone-based date shifting

**Before**:
```typescript
export function formatDateForInput(dateString: string | null | undefined): string {
  if (!dateString) return '';
  
  try {
    const date = parseISO(dateString);
    return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd'); // TIMEZONE CONVERSION!
  } catch (error) {
    return '';
  }
}
```

**After**:
```typescript
export function formatDateForInput(dateString: string | null | undefined): string {
  if (!dateString) return '';
  
  try {
    // If already in YYYY-MM-DD format, return as-is (NO CONVERSION)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }
    
    // If ISO string with time, extract just the date part
    if (dateString.includes('T')) {
      return dateString.split('T')[0];
    }
    
    // Fallback to timezone conversion
    const date = parseISO(dateString);
    return formatInTimeZone(date, TIMEZONE, 'yyyy-MM-dd');
  } catch (error) {
    return '';
  }
}
```

### 2. Enhanced Date Saving Logic in JobEditForm
**Location**: `src/components/JobEditForm.tsx` - `handleSubmit` function

**Changes**:
- Added explicit logging of the date being sent to the database
- Ensures date stays in YYYY-MM-DD format without conversion
- Added comment explaining the expected format

**Code**:
```typescript
// Ensure the date is in YYYY-MM-DD format without timezone conversion
// The date input gives us a string like "2026-01-12", which is perfect
const scheduledDate = formData.scheduled_date;
console.log('JobEditForm: Sending scheduled_date to DB:', scheduledDate);

const { error } = await supabase
  .from('jobs')
  .update({
    // ... other fields
    scheduled_date: scheduledDate
  })
```

## How It Works Now

### Loading a Date (Read from DB):
1. Database returns: `"2026-01-12"` or `"2026-01-12T00:00:00"`
2. `formatDateForInput()` detects it's already YYYY-MM-DD or extracts date from ISO
3. Returns: `"2026-01-12"` (no timezone conversion)
4. Date input displays: **January 12, 2026** ✅

### Saving a Date (Write to DB):
1. User selects: **January 12, 2026**
2. Date input provides: `"2026-01-12"`
3. `handleChange` updates: `formData.scheduled_date = "2026-01-12"`
4. `handleSubmit` saves: `scheduled_date: "2026-01-12"`
5. Database stores: `"2026-01-12"` ✅

## Why This Fixes the Problem

**Before**: 
- Date "2026-01-12" → parseISO → timezone conversion → might shift to "2026-01-11" or "2026-01-13" depending on local timezone vs Eastern Time

**After**: 
- Date "2026-01-12" → stays as "2026-01-12" → no conversion → correct date ✅

## Testing Instructions

1. **Clear browser cache and restart dev server** (important!)
   ```bash
   # Stop the server (Ctrl+C if running)
   npm run dev
   ```

2. **Test Date Update**:
   - Open browser console (F12)
   - Navigate to a job and click "Edit"
   - Note the current scheduled date
   - Change to a different date (e.g., from Jan 9 → Jan 12)
   - Check console logs:
     ```
     JobEditForm: Field changed - scheduled_date: 2026-01-12
     JobEditForm: Updated formData: { scheduled_date: "2026-01-12", ... }
     JobEditForm: Sending scheduled_date to DB: 2026-01-12
     ```
   - Click "Save Changes"
   - Navigate back to job details
   - ✅ Verify the date shows as **January 12** (not January 11 or 13)

3. **Test Multiple Dates**:
   - Try dates in different months
   - Try dates at month boundaries (e.g., Jan 31 → Feb 1)
   - Try dates far in the past and future
   - All should save exactly as selected

## Additional Notes

- This fix also prevents issues when users are in different timezones
- Date-only fields should always use pure date strings (YYYY-MM-DD)
- DateTime fields (with time components) should still use timezone conversion
- The `scheduled_date` column in the database should be DATE type (not TIMESTAMP)

## Files Modified
- ✅ `src/lib/dateUtils.ts` - Fixed `formatDateForInput()` function
- ✅ `src/components/JobEditForm.tsx` - Enhanced date saving logic and logging

## Status
✅ **COMPLETE** - Date timezone issue fixed. Dates now save correctly without off-by-one errors.
