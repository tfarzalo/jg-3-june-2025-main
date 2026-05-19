# Edge Function Deployment Verification

## Deployment Status ✅

**Date:** May 19, 2026 01:06 UTC

### Deployed Functions

1. **send-sms** 
   - Version: 8
   - Status: ACTIVE
   - Updated: 2026-05-19 01:06:14 UTC
   - Changes: Now stores actual ClickSend status values

2. **dispatch-sms-notification**
   - Version: 11  
   - Status: ACTIVE
   - Updated: 2026-05-19 01:06:20 UTC
   - Changes: Role-based recipient resolution for admin notifications

---

## What to Test Next

### 1. Verify ClickSend Status Display

**Test:** Send an SMS to a trial account number

```bash
# Example: Send a test SMS
curl -X POST https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-sms \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1YOUR_TRIAL_NUMBER",
    "body": "Test message to verify status display",
    "event_type": "test"
  }'
```

**Expected Result:**
- SMS log shows actual ClickSend status (e.g., "REGISTRATION_NEEDED" or "SUCCESS")
- UI displays appropriate badge color (orange for REGISTRATION_NEEDED, green for SUCCESS)
- No generic "SENT" status for new messages

**Check Logs:**
```sql
SELECT 
  created_at,
  status,
  provider_status,
  error_message,
  message_body
FROM sms_notification_logs
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 10;
```

### 2. Verify Admin Notifications

**Test A: Job Acceptance**
1. Have a subcontractor accept a job
2. Check if admin user received SMS

**Expected Result:**
- Admin receives SMS notification
- Subcontractor who accepted the job does NOT receive SMS (unless they're also an admin)
- Other subcontractors do NOT receive SMS

**Check Logs:**
```sql
-- Find admin notifications for job_accepted
SELECT 
  l.created_at,
  l.event_type,
  l.status,
  p.full_name,
  p.role,
  l.message_body
FROM sms_notification_logs l
JOIN profiles p ON p.id = l.user_id
WHERE l.event_type = 'job_accepted'
  AND l.created_at > NOW() - INTERVAL '1 hour'
ORDER BY l.created_at DESC;
```

**Test B: Work Order Submission**
1. Have a subcontractor submit a work order
2. Check if admin user received SMS

**Expected Result:**
- Admin receives SMS notification
- Subcontractor who submitted does NOT receive SMS

**Check Logs:**
```sql
-- Find admin notifications for work_order_submitted
SELECT 
  l.created_at,
  l.event_type,
  l.status,
  p.full_name,
  p.role,
  l.message_body
FROM sms_notification_logs l
JOIN profiles p ON p.id = l.user_id
WHERE l.event_type = 'work_order_submitted'
  AND l.created_at > NOW() - INTERVAL '1 hour'
ORDER BY l.created_at DESC;
```

**Test C: Chat Message (Direct)**
1. Send a chat message to a specific user (admin or subcontractor)
2. Check if ONLY that user received SMS

**Expected Result:**
- Only the specific recipient receives SMS
- Sender does NOT receive SMS
- Other admins do NOT receive SMS (it's not a system-wide event)

**Check Logs:**
```sql
-- Find chat notifications
SELECT 
  l.created_at,
  l.event_type,
  l.status,
  p.full_name,
  p.role,
  l.message_body
FROM sms_notification_logs l
JOIN profiles p ON p.id = l.user_id
WHERE l.event_type = 'chat_received'
  AND l.created_at > NOW() - INTERVAL '1 hour'
ORDER BY l.created_at DESC;
```

### 3. Monitor Edge Function Logs

```bash
# Watch send-sms logs in real-time
npx supabase functions logs send-sms --tail

# Watch dispatch-sms-notification logs in real-time
npx supabase functions logs dispatch-sms-notification --tail
```

**Look for:**
- ✅ `[send-sms] 📊 Final status: SUCCESS` (or other ClickSend status)
- ✅ `[dispatch-sms] 🔔 Resolving admin recipients for job_accepted`
- ✅ `[dispatch-sms] 💬 Resolving direct message recipients for chat_received`
- ✅ `[dispatch-sms] 👥 Found X admin(s) for job_accepted`
- ❌ Database constraint errors
- ❌ "Invalid eventType" errors
- ❌ "Failed to query admin SMS recipients" errors

### 4. Verify Admin Settings in Database

```sql
-- Check that admin users have the new notification columns enabled
SELECT 
  p.full_name,
  p.role,
  p.sms_phone,
  p.sms_consent_given,
  s.sms_enabled,
  s.notify_admin_job_accepted,
  s.notify_admin_work_order_submitted,
  s.notify_admin_charges_approved
FROM profiles p
LEFT JOIN user_sms_notification_settings s ON s.user_id = p.id
WHERE p.role IN ('admin', 'is_super_admin', 'jg_management')
ORDER BY p.full_name;
```

**Expected Result:**
- All admin users should have:
  - `notify_admin_job_accepted = true`
  - `notify_admin_work_order_submitted = true`
  - `notify_admin_charges_approved = true`

### 5. Check for Errors

```sql
-- Check for failed SMS in the last hour
SELECT 
  created_at,
  event_type,
  status,
  error_message,
  skip_reason,
  phone_last4,
  message_body
FROM sms_notification_logs
WHERE (status = 'failed' OR error_message IS NOT NULL)
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## Common Issues and Solutions

### Issue: Status Still Shows "sent" Instead of ClickSend Status

**Cause:** Database migration not applied or edge function deployment didn't include the changes

**Solution:**
1. Verify migration applied:
   ```sql
   SELECT constraint_name, check_clause
   FROM information_schema.check_constraints
   WHERE constraint_name = 'sms_notification_logs_status_check';
   ```
2. Redeploy edge function if needed
3. Send a new test SMS (old logs won't be updated)

### Issue: Admin Not Receiving System-Wide Notifications

**Cause:** Admin settings not enabled or dispatch function routing incorrectly

**Solution:**
1. Check admin settings (see query above)
2. Check dispatch function logs for routing path
3. Verify event type matches expected admin events

### Issue: Subcontractor Receiving System-Wide Notifications

**Cause:** Dispatch function not filtering by role correctly

**Solution:**
1. Check dispatch function logs
2. Verify `resolveAdminNotificationRecipients()` is filtering by role
3. Check that subcontractor's role is not 'admin', 'is_super_admin', or 'jg_management'

---

## Rollback if Needed

If issues occur, you can rollback:

```bash
# Revert to previous function versions (if needed)
# Note: You'll need the previous version numbers

# Or apply rollback SQL:
# See SMS_COMPLETE_DEPLOYMENT_GUIDE.md for rollback procedures
```

---

## Success Criteria

✅ Edge functions deployed without errors  
⏳ Test SMS shows actual ClickSend status (not generic "sent")  
⏳ UI displays appropriate status badge  
⏳ Admin receives SMS for job acceptance  
⏳ Admin receives SMS for work order submission  
⏳ Subcontractor does NOT receive SMS for other users' actions  
⏳ Chat messages go only to specific recipients  
⏳ No database constraint errors in logs  
⏳ No function execution errors  

---

**Next Step:** Test the system with real actions and verify the behavior matches expectations!

See [SMS_COMPLETE_DEPLOYMENT_GUIDE.md](./SMS_COMPLETE_DEPLOYMENT_GUIDE.md) for complete testing procedures.
