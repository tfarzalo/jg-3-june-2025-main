# ClickSend SMS Troubleshooting Guide

**Date:** May 18, 2026  
**Issue:** Chat SMS notifications not appearing in logs  
**Status:** 🔍 INVESTIGATING

---

## ✅ What We've Verified

### Database Configuration
- ✅ `user_sms_notification_settings` table exists with all `notify_*` columns
- ✅ Test user (Timothy Farzalo) has `notify_chat_received = true`
- ✅ Test user has `sms_consent_given = true`
- ✅ Test user has valid SMS phone: `+17049603722`
- ✅ `sms_notification_logs` table exists and is queryable
- ✅ SMS Logs UI component reads from correct table

### Edge Functions
- ✅ `send-sms` deployed successfully
- ✅ `handle-clicksend-delivery` deployed successfully
- ✅ `dispatch-sms-notification` deployed successfully

---

## ❌ What's Not Working

When sending a chat message:
- ❌ No entry created in `sms_notification_logs`
- ❌ No SMS received by recipient
- ❌ No errors visible in UI

This suggests one of:
1. The `dispatch-sms-notification` edge function is not being called
2. The edge function is failing silently before writing a log
3. ClickSend credentials are not set correctly

---

## 🔧 Diagnostic Steps

### Step 1: Check ClickSend Credentials

```bash
# Verify secrets are set
supabase secrets list
```

Expected output should include:
- `CLICKSEND_USERNAME`
- `CLICKSEND_API_KEY`
- `CLICKSEND_SOURCE` (optional)

**If missing, set them:**
```bash
supabase secrets set CLICKSEND_USERNAME="your_username"
supabase secrets set CLICKSEND_API_KEY="your_api_key"
supabase secrets set CLICKSEND_SOURCE="JGManagement"
```

### Step 2: Check Edge Function Logs

Via Supabase Dashboard:
1. Go to https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh/functions
2. Click on `dispatch-sms-notification`
3. View **Logs** tab
4. Look for recent invocations and any errors

### Step 3: Test Edge Function Directly

```bash
# Test dispatch-sms-notification directly
curl -X POST \
  'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/dispatch-sms-notification' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "chat_received",
    "recipientUserId": "e73e8b31-1c9c-4b56-97be-d85dd30ca26d",
    "context": {
      "senderName": "Test User"
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "SMS notification dispatched"
}
```

### Step 4: Check Browser Console

When sending a chat message:
1. Open browser DevTools (F12)
2. Go to **Console** tab
3. Look for any error messages related to SMS
4. Check **Network** tab for failed requests to edge functions

### Step 5: Verify ChatWindow is Calling the Function

Check if `dispatchSmsNotification` is being called in `ChatWindow.tsx` (line 232-240):

```typescript
// Should see this in browser console
console.log('[ChatWindow] Dispatching SMS notification to:', otherParticipant.id);
```

---

## 🧪 Manual Test Query

To manually insert a test log entry (simulating what the edge function should do):

```sql
-- Insert a test log entry
INSERT INTO sms_notification_logs (
  event_type,
  user_id,
  phone_last4,
  message_body,
  status,
  skip_reason,
  metadata
) VALUES (
  'chat_received',
  'e73e8b31-1c9c-4b56-97be-d85dd30ca26d',
  '3722',
  'Test message from troubleshooting',
  'simulated',
  'Manual test entry',
  '{"test": true}'::jsonb
) RETURNING id, created_at;
```

Then check if it appears in the SMS Logs UI.

---

## 🔍 Old Twilio Data

The current logs show Twilio message SIDs (starting with "SM"). This is **old data** from before the ClickSend migration. To clean up old logs:

```sql
-- Option 1: Archive old Twilio logs (recommended)
UPDATE sms_notification_logs
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{archived}',
  'true'::jsonb
)
WHERE provider_message_sid LIKE 'SM%'
  AND created_at < '2026-05-18';

-- Option 2: Delete old Twilio logs (use with caution)
-- DELETE FROM sms_notification_logs
-- WHERE provider_message_sid LIKE 'SM%'
--   AND created_at < '2026-05-18';

-- Option 3: Clear ALL logs and start fresh (DESTRUCTIVE!)
-- TRUNCATE sms_notification_logs;
```

---

## 🎯 Expected Behavior

When a chat message is sent:

1. **ChatWindow.tsx** calls `dispatchSmsNotification()`
2. **Client-side** function calls `supabase.functions.invoke('dispatch-sms-notification')`
3. **Edge function** receives the request
4. **Edge function** queries `user_sms_notification_settings`
5. **Edge function** checks if `notify_chat_received = true`
6. **Edge function** calls `/functions/v1/send-sms`
7. **send-sms** writes a log entry (status: 'queued')
8. **send-sms** calls ClickSend API
9. **send-sms** updates log entry (status: 'sent' or 'failed')
10. **ClickSend** sends the SMS
11. **handle-clicksend-delivery** receives delivery receipt webhook
12. **Webhook** updates log entry with delivery status

**Current status:** Stuck at step 2-3 (edge function not being invoked or failing immediately)

---

## 🚨 Most Likely Issues

### 1. ClickSend Credentials Not Set
**Solution:** Run `supabase secrets list` and set missing credentials

### 2. Edge Function Not Deployed with Secrets
**Solution:** Redeploy functions after setting secrets:
```bash
supabase functions deploy send-sms
supabase functions deploy dispatch-sms-notification
```

### 3. Client-Side Error
**Solution:** Check browser console for errors

### 4. CORS or Authorization Issue
**Solution:** Verify Supabase URL and API keys in `.env`

---

## 📝 Action Items

- [ ] Verify ClickSend credentials are set (`supabase secrets list`)
- [ ] Check edge function logs in Supabase Dashboard
- [ ] Test edge function directly with curl command
- [ ] Check browser console when sending chat message
- [ ] Run manual test query to verify logs UI is working
- [ ] Consider clearing old Twilio data
- [ ] If nothing works, redeploy all functions after setting credentials

---

## 🔗 Related Files

- `/supabase/functions/dispatch-sms-notification/index.ts` - Main dispatcher
- `/supabase/functions/send-sms/index.ts` - ClickSend API caller
- `/src/components/chat/ChatWindow.tsx` - Triggers SMS on chat message
- `/src/lib/sms/dispatchSmsNotification.ts` - Client-side helper
- `/src/components/SmsNotificationLogs.tsx` - Admin logs UI

---

**Next Steps:** Run diagnostic steps 1-5 above and report findings.
