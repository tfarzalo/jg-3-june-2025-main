# ClickSend Status Display Fix - Deployment Guide

## Problem
SMS logs were showing generic "SENT" status instead of the actual ClickSend API response status (e.g., "SUCCESS", "REGISTRATION_NEEDED", etc.). This made it impossible to diagnose why messages weren't being delivered to trial account phone numbers.

## Root Cause
1. Database constraint only allowed specific enum values: 'queued', 'sent', 'failed', 'skipped', 'simulated'
2. When ClickSend returned status like "SUCCESS" or "REGISTRATION_NEEDED", the database would reject it
3. The `send-sms` function would fall back to storing "sent" instead of the actual ClickSend status
4. The UI didn't have badge configurations for ClickSend-specific statuses

## Solution Overview

### 1. Database Migration
**File:** `supabase/migrations/20260518000004_allow_clicksend_status_values.sql`

This migration:
- Removes the restrictive CHECK constraint
- Replaces it with a constraint that allows any non-empty string
- Adds a comment documenting common ClickSend status values
- Marks existing "sent" records with a legacy flag in metadata

### 2. Edge Function Update
**File:** `supabase/functions/send-sms/index.ts`

Changes:
- Updated `writeLog` function to accept `status: string` instead of enum
- Added logging to show what status is being stored
- Already stores the actual ClickSend status when available

### 3. UI Component Update
**File:** `src/components/SmsNotificationLogs.tsx`

Changes:
- Added badge configurations for common ClickSend statuses:
  - `SUCCESS` → Green "Success" badge
  - `REGISTRATION_NEEDED` → Orange "Registration Required" badge
  - `INVALID_NUMBER` → Red "Invalid Number" badge
  - `OPTED_OUT` → Yellow "Opted Out" badge
- Added fallback configuration for unknown statuses
- Shows actual status text when no specific badge exists
- Added tooltip showing raw ClickSend status for unknown values

## Deployment Steps

### Step 1: Apply Database Migration

```bash
# Navigate to project root
cd /Users/timothyfarzalo/Desktop/jg-january-2026

# Apply the migration via Supabase CLI
npx supabase db push
```

**OR** apply manually via SQL Editor in Supabase Dashboard:

```sql
-- Copy the entire contents of:
-- supabase/migrations/20260518000004_allow_clicksend_status_values.sql
-- and run it in the SQL Editor
```

### Step 2: Verify Migration Applied

Run this query in Supabase SQL Editor:

```sql
-- Check the constraint
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'sms_notification_logs_status_check';

-- Expected result:
-- check_clause should be: 
-- ((status IS NOT NULL) AND (length(trim(BOTH FROM status)) > 0))
```

### Step 3: Deploy Edge Function

```bash
# Deploy the updated send-sms function
npx supabase functions deploy send-sms

# Verify it's deployed
npx supabase functions list
```

### Step 4: Deploy Frontend

```bash
# Build the React app
npm run build

# Deploy to your hosting platform
# (The exact command depends on your deployment setup)
```

### Step 5: Test End-to-End

1. **Send a test SMS** to a phone number that requires registration (trial account):
   ```bash
   # Use the Supabase Functions invoke command or send via the UI
   curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/send-sms \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "to": "+1234567890",
       "body": "Test message",
       "event_type": "test"
     }'
   ```

2. **Check the logs** in Admin → App Settings → SMS Logs tab

3. **Verify the status badge**:
   - For trial accounts: Should show "Registration Required" (orange)
   - For successful sends: Should show "Success" (green)
   - For invalid numbers: Should show "Invalid Number" (red)

## What Changed

### Before
```
SMS Log Status: "SENT" (green badge)
Actual ClickSend Response: { status: "REGISTRATION_NEEDED", message: "..." }
```

**Problem:** User sees green "SENT" badge but message was never delivered.

### After
```
SMS Log Status: "REGISTRATION_NEEDED" (orange badge with label "Registration Required")
Actual ClickSend Response: { status: "REGISTRATION_NEEDED", message: "..." }
```

**Result:** User immediately sees the issue and knows to register the phone number.

## Common ClickSend Status Values

| Status | Meaning | Badge Color | Action Required |
|--------|---------|-------------|-----------------|
| `SUCCESS` | Message queued/sent successfully | Green | None |
| `REGISTRATION_NEEDED` | Phone number must be registered (trial accounts) | Orange | Register phone in ClickSend dashboard |
| `INVALID_NUMBER` | Phone number is invalid | Red | Fix phone number format |
| `OPTED_OUT` | Recipient opted out of SMS | Yellow | Recipient must opt back in |
| `CARRIER_FAILURE` | Carrier rejected the message | Red | Try different number or carrier |
| `failed` | Network error reaching ClickSend | Red | Check API credentials |
| `queued` | Internal status before sending | Gray | Temporary, will update |
| `skipped` | User has SMS disabled | Yellow | Enable SMS in user settings |
| `simulated` | Dry-run mode, not actually sent | Purple | None (test mode) |

## Rollback Plan

If issues occur after deployment:

```sql
-- 1. Revert the constraint to old enum
ALTER TABLE sms_notification_logs
  DROP CONSTRAINT IF EXISTS sms_notification_logs_status_check;

ALTER TABLE sms_notification_logs
  ADD CONSTRAINT sms_notification_logs_status_check
  CHECK (status IN ('queued', 'sent', 'failed', 'skipped', 'simulated'));

-- 2. Update any ClickSend statuses to generic "sent"
UPDATE sms_notification_logs
SET status = 'sent'
WHERE status NOT IN ('queued', 'sent', 'failed', 'skipped', 'simulated')
  AND error_message IS NULL;
```

Then redeploy the previous version of the Edge Function and UI.

## Monitoring

After deployment, monitor:

1. **Error rate** in Edge Function logs:
   ```bash
   npx supabase functions logs send-sms --tail
   ```
   Look for database constraint errors

2. **Log entries** in `sms_notification_logs`:
   ```sql
   SELECT status, COUNT(*) as count
   FROM sms_notification_logs
   WHERE created_at > NOW() - INTERVAL '1 day'
   GROUP BY status
   ORDER BY count DESC;
   ```

3. **User reports** of missing/incorrect status badges in UI

## Success Criteria

✅ Migration applied without errors  
✅ Edge function deployed successfully  
✅ Frontend built and deployed  
✅ Test SMS shows correct ClickSend status in logs  
✅ UI displays appropriate badge and color for status  
✅ No database constraint errors in logs  
✅ Users can identify delivery issues at a glance  

## Support

For issues:
1. Check Supabase Edge Function logs
2. Check browser console for UI errors
3. Verify migration applied: `SELECT * FROM sms_notification_logs WHERE status NOT IN ('queued', 'sent', 'failed', 'skipped', 'simulated') LIMIT 1;`
4. Review ClickSend API docs: https://developers.clicksend.com/docs/rest/v3/

---

**Last Updated:** May 18, 2026  
**Migration File:** `20260518000004_allow_clicksend_status_values.sql`  
**Related Files:**
- `supabase/functions/send-sms/index.ts`
- `src/components/SmsNotificationLogs.tsx`
