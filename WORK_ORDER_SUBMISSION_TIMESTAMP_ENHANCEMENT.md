# Work Order Submission Timestamp Enhancement

## Date: December 13, 2025

## Summary
Added a human-readable submission timestamp with username below the Work Order Submission Date field.

## Changes Made

### 1. Frontend Updates

#### `src/lib/dateUtils.ts`
- Added new `formatTime()` function to format timestamps in Eastern Time
- Format: `h:mm a` (e.g., "2:30 PM")

#### `src/hooks/useJobDetails.ts`
- Updated `work_order` interface to include:
  - `created_at?: string` - timestamp when work order was created
  - `submitted_by_name?: string` - full name of user who submitted

#### `src/components/JobDetails.tsx`
- Imported `formatTime` function
- Updated `WorkOrder` interface to include new fields
- Enhanced Submission Date display to show timestamp and username below the date:
  ```tsx
  {job?.work_order?.created_at && (
    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
      {formatTime(job.work_order.created_at)} | {job?.work_order?.submitted_by_name || 'Unknown User'}
    </p>
  )}
  ```

### 2. Database Updates

#### `add_work_order_submission_timestamp.sql`
- Updated `get_job_details()` function to include:
  - `created_at` field from work_orders table
  - `submitted_by_name` from users table via JOIN on `user_id`
- Added LEFT JOIN to users table: `LEFT JOIN users u ON u.id = wo.user_id`

## Display Format

**Visual Layout:**
```
┌─────────────────────────────────────┐
│ Submission Date                      │
│ Dec 13, 2025                         │
│ 2:30 PM | John Smith                │
└─────────────────────────────────────┘
```

- **Line 1:** Label "Submission Date" (small gray text)
- **Line 2:** Full date (large bold green text)
- **Line 3:** Time | Username (smaller gray text)
  - Time shown in Eastern Time (e.g., "2:30 PM")
  - Pipe separator
  - Full name of submitting user

## Features

✅ Human-readable 12-hour time format with AM/PM
✅ Automatically converts to Eastern Time zone
✅ Displays full name of user who submitted the work order
✅ Falls back to "Unknown User" if name is not available
✅ Only displays if `created_at` timestamp exists
✅ Maintains existing green highlight styling for submitted work orders
✅ Responsive design (smaller text that doesn't interfere with main date)

## Technical Details

### Time Formatting
- Uses `date-fns-tz` library's `formatInTimeZone()` function
- Timezone: `America/New_York` (Eastern Time)
- Format: `'h:mm a'` (e.g., "9:15 AM", "3:45 PM")

### Database Schema Assumptions
- `work_orders.created_at` - timestamp field (should exist)
- `work_orders.user_id` - foreign key to users table (should exist)
- `users.full_name` - user's full name

## Deployment Steps

1. **Apply Database Migration:**
   ```bash
   # Run the SQL file in Supabase SQL Editor or via CLI
   psql -d your_database -f add_work_order_submission_timestamp.sql
   ```

2. **Frontend is Already Updated:**
   - Changes are in the TypeScript/React code
   - Will take effect after next deployment/build

## Testing

To verify the changes:
1. Open any job with a work order
2. Check the "Submission Date" field in the Work Order Details section
3. Verify you see:
   - The submission date (e.g., "Dec 13, 2025")
   - Below it: timestamp and username (e.g., "2:30 PM | John Smith")

## Notes

- If `created_at` is null, the timestamp line won't display
- If `user_id` is null or user not found, displays "Unknown User"
- Styling maintains the existing design system (small, gray text)
- Does not interfere with the existing date display
