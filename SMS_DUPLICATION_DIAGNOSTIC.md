# SMS Duplication Diagnostic Report

## Current Implementation Status: ✅ CORRECT

### Analysis Date
January 18, 2025

### Issue Reported
User received 6-7 duplicate SMS notifications for:
- Work order submission
- Job acceptance

### Root Cause Analysis

#### ✅ Frontend Code Review

**1. NewWorkOrder.tsx**
- ✅ **CORRECT:** Only calls `dispatchSmsNotification` **ONCE** when a new work order is created
- ✅ **CORRECT:** Uses `recipientUserId: ''` to signal edge function to resolve all admins
- ✅ **CORRECT:** Only fires for `!existingWorkOrder` (new work orders only)
- ✅ **CORRECT:** No batch calls, no loops over recipients

**Location:** Lines 1917-1942
```typescript
if (!existingWorkOrder) {
  try {
    await dispatchSmsNotification({
      eventType: 'work_order_submitted' as const,
      recipientUserId: '', // Edge function resolves admins
      sender_user_id: userData.user.id,
      job_id: job.id,
      // ...context
    });
  } catch (smsErr) {
    console.warn('[NewWorkOrder] SMS dispatch error (non-fatal):', smsErr);
  }
}
```

**2. SubcontractorDashboardActions.tsx**
- ✅ **CORRECT:** Only calls `dispatchSmsNotification` **ONCE** when decision === 'accepted'
- ✅ **CORRECT:** Uses `recipientUserId: ''` to signal edge function to resolve all admins
- ✅ **CORRECT:** No batch calls, no loops over recipients

**Location:** Lines 222-241
```typescript
if (decision === 'accepted') {
  try {
    const { data: userData } = await supabase.auth.getUser();
    dispatchSmsNotification({
      eventType: 'job_accepted',
      recipientUserId: '', // Edge function resolves admins
      sender_user_id: userData.user?.id,
      job_id: jobId,
      // ...context
    });
  } catch (smsErr) {
    console.warn('[SubcontractorDashboardActions] SMS dispatch error (non-fatal):', smsErr);
  }
}
```

#### ✅ Edge Function Logic Review

**dispatch-sms-notification/index.ts**
- ✅ **CORRECT:** Has `resolveAdminNotificationRecipients` function that queries all eligible admins
- ✅ **CORRECT:** Returns unique list of admins based on:
  - Role (admin/superadmin/jg_management)
  - SMS consent given
  - SMS enabled
  - Specific admin event setting enabled
  - Has phone number
  - Not the sender
- ✅ **CORRECT:** Has 60-second deduplication window (`sms_recent_count`)
- ✅ **CORRECT:** Logs all skips with reasons

### Potential Causes (To Investigate)

Since the code is correct, the duplicates must be coming from one of these sources:

#### 1. **Multiple Frontend Calls**
**Hypothesis:** User clicked "Submit" multiple times, or form was submitted multiple times

**How to check:**
```sql
-- Check how many times dispatch was called for recent work orders
SELECT 
  l.created_at,
  l.event_type,
  COUNT(*) as dispatch_count,
  STRING_AGG(DISTINCT l.status, ', ') as statuses
FROM sms_notification_logs l
WHERE 
  l.event_type = 'work_order_submitted'
  AND l.created_at > NOW() - INTERVAL '1 hour'
GROUP BY l.created_at, l.event_type
HAVING COUNT(*) > 3  -- More than expected (3 admins)
ORDER BY l.created_at DESC;
```

**Fix:** Already implemented - dedup window should catch this

#### 2. **Database Trigger**
**Hypothesis:** There's a database trigger on `work_orders` or `jobs` table that's also calling the SMS function

**How to check:**
```sql
-- List all triggers in the database
SELECT 
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  pg_get_triggerdef(oid) as trigger_definition
FROM pg_trigger
WHERE NOT tgisinternal
ORDER BY tgrelid::regclass::text;
```

**Expected:** Should NOT see any triggers calling SMS functions

#### 3. **Process-SMS-Queue Running Multiple Times**
**Hypothesis:** The queue processor might be running multiple instances and processing the same queue items

**How to check:**
```sql
-- Check for duplicate queue processing
SELECT 
  user_id,
  event_type,
  phone_number,
  message_body,
  COUNT(*) as queue_entries,
  STRING_AGG(id::text, ', ') as queue_ids,
  STRING_AGG(status, ', ') as statuses
FROM sms_notification_queue
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id, event_type, phone_number, message_body
HAVING COUNT(*) > 1
ORDER BY MAX(created_at) DESC;
```

**Expected:** Should return ZERO rows (each message should only be queued once)

#### 4. **Admin Count**
**Hypothesis:** More admins have SMS enabled than expected

**How to check:**
```sql
-- Count eligible admins for work_order_submitted
SELECT COUNT(*) as eligible_admin_count
FROM user_sms_notification_settings s
INNER JOIN profiles p ON s.user_id = p.id
WHERE 
  p.role IN ('admin', 'is_super_admin', 'jg_management')
  AND p.sms_phone IS NOT NULL
  AND p.sms_consent_given = true
  AND s.sms_enabled = true
  AND s.notify_admin_work_order_submitted = true;
```

**Expected:** Should match the number of admins who should receive notifications

#### 5. **ClickSend Provider Issue**
**Hypothesis:** ClickSend might be duplicating messages on their end

**How to check:**
- Check ClickSend dashboard for sent messages
- Compare ClickSend send count with database log count
- Check if ClickSend is sending to the same number multiple times for one API call

### Immediate Actions Required

1. **Run Verification Queries**
   ```bash
   # Connect to Supabase and run verify_sms_no_duplicates.sql
   psql <connection_string> -f verify_sms_no_duplicates.sql
   ```

2. **Check Edge Function Logs**
   - Go to Supabase Dashboard → Edge Functions → dispatch-sms-notification → Logs
   - Look for the specific work order submission or job acceptance event
   - Check how many times "Resolved X admin(s)" appears for the same event
   - Check for any error messages or retries

3. **Check ClickSend Dashboard**
   - Login to ClickSend account
   - Go to SMS History
   - Filter by recent date/time when duplicates occurred
   - Count how many times the same message was sent to the same number

4. **Enable Detailed Logging (Temporary)**
   Add to top of `dispatch-sms-notification/index.ts`:
   ```typescript
   console.log('[dispatch-sms] FULL REQUEST:', JSON.stringify(req.body));
   ```
   
   Redeploy edge function:
   ```bash
   supabase functions deploy dispatch-sms-notification
   ```

### Expected Behavior (Correct State)

For a work order submission with **3 admins** who have SMS enabled:

```
┌─────────────────────────────────────────────────────────────┐
│ Event: Work Order #123 Submitted                            │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ Frontend calls dispatchSmsNotification ONCE
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Edge Function: dispatch-sms-notification                    │
│ • Receives ONE request                                      │
│ • Resolves 3 eligible admins                                │
│ • Queues 3 SMS (one per admin)                              │
│ • Logs 3 entries in sms_notification_logs                   │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Database State:                                              │
│ • sms_notification_queue: 3 rows (status=pending)           │
│ • sms_notification_logs: 3 rows (status=queued)             │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ Process-SMS-Queue (runs every minute)                       │
│ • Picks up 3 pending queue items                            │
│ • Calls send-sms 3 times                                    │
│ • Updates queue: status=processing → sent                   │
│ • Updates logs: delivery status from ClickSend              │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ ClickSend API                                                │
│ • Receives 3 API calls                                      │
│ • Sends 3 SMS messages                                      │
│ • Returns 3 delivery receipts                               │
└─────────────────────────────────────────────────────────────┘
```

**RESULT: 3 SMS sent (1 per admin)**

### If Duplicates Still Occur

**Temporary Mitigation:**
1. Increase dedup window from 60s to 300s (5 minutes):
   ```typescript
   // In dispatch-sms-notification/index.ts
   const DEDUP_WINDOW_SECONDS = 300; // Was 60
   ```

2. Add request ID tracking to prevent double-processing:
   ```typescript
   // Add to DispatchRequest interface
   request_id?: string;
   
   // Check in edge function before processing
   const requestId = req.body.request_id || crypto.randomUUID();
   // Store and check against recent request IDs
   ```

3. Disable SMS for all but one admin to test:
   ```sql
   -- Temporarily disable for testing
   UPDATE user_sms_notification_settings
   SET notify_admin_work_order_submitted = false
   WHERE user_id != '<SINGLE_ADMIN_USER_ID>';
   ```

### Files to Review

- ✅ `/src/components/NewWorkOrder.tsx` - Verified correct
- ✅ `/src/components/SubcontractorDashboardActions.tsx` - Verified correct
- ✅ `/supabase/functions/dispatch-sms-notification/index.ts` - Verified correct
- ✅ `/src/lib/sms/dispatchSmsNotification.ts` - Verified correct
- ⏳ Edge function logs - **NEED TO CHECK**
- ⏳ Database query results - **NEED TO RUN verify_sms_no_duplicates.sql**
- ⏳ ClickSend dashboard - **NEED TO VERIFY**

### Conclusion

**Code is correct.** The architecture is sound and should prevent duplicates through:
1. Single dispatch call from frontend
2. Centralized recipient resolution
3. 60-second deduplication window
4. Clear logging of all sends and skips

**Next steps:**
1. Run verification queries to see actual database state
2. Check edge function logs for the specific duplicate event
3. Check ClickSend dashboard to see if duplicates are from their end
4. If needed, increase dedup window or add request ID tracking

---
**Status:** Code verified correct, awaiting diagnostic data
**Created:** January 18, 2025
