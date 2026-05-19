# ClickSend SMS - Current Status & Next Steps

**Date:** May 18, 2026  
**Commit:** `91b889a`  
**Status:** 🔧 PARTIALLY COMPLETE - Needs Troubleshooting

---

## ✅ What's Working

### Database
- ✅ `user_sms_notification_settings` table has all `notify_*` columns
- ✅ `sms_notification_logs` table exists and is queryable
- ✅ Test user (Timothy Farzalo) has correct settings:
  - `notify_chat_received = true`
  - `sms_consent_given = true`
  - `sms_phone = +17049603722`

### Edge Functions
- ✅ `send-sms` deployed successfully
- ✅ `handle-clicksend-delivery` deployed successfully  
- ✅ `dispatch-sms-notification` deployed successfully
- ✅ All ClickSend secrets are set:
  - `CLICKSEND_USERNAME`
  - `CLICKSEND_API_KEY`
  - `CLICKSEND_SOURCE`

### UI/UX
- ✅ SMS Logs page excludes archived Twilio data
- ✅ Old Twilio logs (23 total) archived with metadata flag
- ✅ SMS Notification Settings component properly structured
- ✅ ChatWindow has correct `dispatchSmsNotification` call

---

## ❌ What's NOT Working

### Chat SMS Notifications
- ❌ When sending a chat message, **no SMS is sent**
- ❌ **No log entry created** in `sms_notification_logs`
- ❌ No errors visible in browser console (need to check)
- ❌ Edge function may not be getting called at all

### Evidence
- Zero `chat_received` logs in the database
- Zero ClickSend logs (only 23 old Twilio + 65 skipped logs exist)
- Last log activity was 2 hours ago (not related to chat test)

---

## 🔍 Root Cause Analysis

The issue is likely one of:

### Theory 1: Edge Function Not Being Called
- Client-side `dispatchSmsNotification()` may be failing silently
- Check browser console for errors
- Verify `supabase.functions.invoke()` is working

### Theory 2: Edge Function Failing Immediately
- Function receives request but fails before writing log
- Check Supabase Dashboard function logs
- Look for authorization or configuration errors

### Theory 3: Missing ClickSend Credentials in Function
- Secrets are set globally but may not be available to functions
- Need to redeploy functions after setting secrets

### Theory 4: CORS or Network Issue
- Request blocked before reaching edge function
- Check browser Network tab

---

## 🎯 Immediate Action Items

### 1. Check Browser Console (CRITICAL)
When testing chat message:
1. Open DevTools (F12)
2. Send a chat message
3. Check **Console** tab for errors
4. Check **Network** tab for failed requests to `/functions/v1/dispatch-sms-notification`

### 2. Check Edge Function Logs
1. Go to https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh/functions
2. Click `dispatch-sms-notification`
3. View **Logs** tab
4. Look for recent invocations (should see timestamp when you sent chat)

### 3. Test Edge Function Directly
```bash
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

### 4. If Test Works, Re-Deploy Functions
If direct test works but UI doesn't trigger it:
```bash
# Redeploy all SMS functions
supabase functions deploy send-sms
supabase functions deploy handle-clicksend-delivery
supabase functions deploy dispatch-sms-notification
```

---

## 📊 Database Status

| Metric | Count |
|--------|-------|
| **Total SMS Logs** | 88 |
| **Old Twilio Logs (archived)** | 23 |
| **Skipped Logs** | 65 |
| **ClickSend Logs** | 0 ⚠️ |
| **Chat Logs** | 0 ⚠️ |

### Log Distribution
- **Twilio (old):** 23 logs, archived with metadata flag
- **No provider ID:** 65 logs (mostly skipped/deduplication)
- **ClickSend (new):** **0 logs** ← This is the problem!

---

## 📚 Documentation Created

1. **CLICKSEND_DEPLOYMENT_COMPLETE.md** - Full deployment summary
2. **CLICKSEND_CHAT_SMS_FIX.md** - SMS settings columns fix
3. **CLICKSEND_TROUBLESHOOTING.md** - Comprehensive diagnostic guide
4. **20260518000002_cleanup_old_twilio_sms_logs.sql** - Migration to archive old data

---

## 🔧 Technical Details

### SMS Settings Storage
- **Table:** `user_sms_notification_settings` (NOT `profiles`)
- **Columns:** `notify_chat_received`, `notify_job_assigned`, etc.
- **Junction:** User settings linked via `user_id` → `profiles.id`

### Edge Function Flow
1. `ChatWindow.tsx` → calls `dispatchSmsNotification()`
2. `dispatchSmsNotification.ts` → calls `supabase.functions.invoke('dispatch-sms-notification')`
3. `dispatch-sms-notification/index.ts` → queries `user_sms_notification_settings`
4. Checks if `notify_chat_received = true`
5. Calls `/functions/v1/send-sms`
6. `send-sms/index.ts` → calls ClickSend API
7. Writes log to `sms_notification_logs`

**Current status:** Flow breaks between steps 2-3 (function not being invoked or failing immediately)

---

## 🚀 Next Steps

### Immediate (Today)
1. ✅ Check browser console for errors when sending chat
2. ✅ Check Supabase Dashboard edge function logs
3. ✅ Test edge function directly with curl
4. ⏳ Identify where the flow breaks
5. ⏳ Fix the issue and re-test

### Short Term (This Week)
- [ ] Get first successful ClickSend SMS sent
- [ ] Verify delivery receipt webhook works
- [ ] Test all 5 notification types
- [ ] Configure ClickSend webhook in dashboard
- [ ] Update documentation with findings

### Long Term
- [ ] Monitor SMS delivery rates
- [ ] Set up alerting for failed SMS
- [ ] Review SMS costs and usage
- [ ] Consider SMS queue/rate limiting if needed

---

## 📝 Files Modified (This Session)

- `/src/components/SmsNotificationLogs.tsx` - Exclude archived logs
- `/supabase/migrations/20260518000001_add_sms_notification_settings_to_profiles.sql` - Added notify_* columns (later found duplicate)
- `/supabase/migrations/20260518000002_cleanup_old_twilio_sms_logs.sql` - Archive old Twilio data
- `CLICKSEND_DEPLOYMENT_COMPLETE.md` - Deployment summary
- `CLICKSEND_CHAT_SMS_FIX.md` - Settings columns documentation
- `CLICKSEND_TROUBLESHOOTING.md` - Diagnostic guide

---

## ⚠️ Critical Finding

**The `notify_*` columns were added to BOTH tables:**
1. `profiles` table (added today, unnecessary duplication)
2. `user_sms_notification_settings` table (correct location, already existed)

The application correctly uses `user_sms_notification_settings`, so the columns in `profiles` are not being used and can be removed if desired.

---

## 🎯 The Core Issue

**NO ClickSend SMS has been sent yet** - not even a failed attempt. The edge function either:
- Is not being called at all (client-side issue)
- Is failing before writing any logs (server-side crash)
- Is being blocked by authorization/CORS

**NEXT:** Run the diagnostic steps in CLICKSEND_TROUBLESHOOTING.md to identify the exact failure point.

---

**Status:** Awaiting diagnostic results from browser console and edge function logs.
