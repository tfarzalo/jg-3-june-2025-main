# Fix for Scheduled Date Off-by-One Issue

## The Problem
When you select January 13 in the job edit form, it saves as January 12 in the database.

## The Solution
I've created a database migration that fixes the trigger function causing this issue.

**Migration file:** `supabase/migrations/20260113000000_fix_scheduled_date_trigger.sql`

## How to Apply the Fix

### Option 1: Using Supabase CLI (Recommended)

If your project is linked to Supabase:

```bash
# Apply the migration
supabase db push
```

### Option 2: Using Supabase Dashboard

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Open the file `supabase/migrations/20260113000000_fix_scheduled_date_trigger.sql`
4. Copy all the contents
5. Paste into the SQL Editor
6. Click **Run**

You should see output showing:
- DROP TRIGGER
- CREATE OR REPLACE FUNCTION
- CREATE TRIGGER
- Test notices showing the date conversion

### Option 3: Link Your Project First

If you get "Cannot find project ref":

```bash
# Link your local project to Supabase
supabase link --project-ref YOUR_PROJECT_REF

# Then push the migration
supabase db push
```

## Verify the Fix

After applying the migration:

1. Edit any job in your application
2. Change the scheduled date to a specific date (e.g., January 15, 2026)
3. Save the form
4. Check the browser console - look for logs like:
   ```
   JobEditForm: Sending EXACT string to database: 2026-01-15
   JobEditForm: What we sent: 2026-01-15
   JobEditForm: What DB has: 2026-01-15T05:00:00.000Z
   JobEditForm: Are they equal? false (this is OK - one is date string, one is timestamptz)
   ```
5. View the job details - it should now show **January 15** (not January 14)

## What Changed

The `ensure_eastern_time` trigger now:
1. Extracts the date portion from the UTC timestamp (e.g., "2026-01-13")
2. Interprets that date as midnight Eastern Time
3. Stores it correctly as `2026-01-13 05:00:00 UTC` (which displays as Jan 13 in ET)

**Before:** "2026-01-13" → treated as Jan 12 19:00 ET → stored as Jan 12
**After:** "2026-01-13" → treated as Jan 13 00:00 ET → stored as Jan 13 ✓

## Debugging

If you want to see what the trigger is doing, check your database logs for NOTICE messages:
```
ensure_eastern_time: Before conversion - received UTC timestamp = ...
ensure_eastern_time: After conversion - final ET timestamp = ...
```

These will show you exactly how dates are being converted.
