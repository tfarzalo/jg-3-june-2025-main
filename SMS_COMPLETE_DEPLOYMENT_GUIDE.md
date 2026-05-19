# Complete SMS System Deployment Guide

## Overview
This guide covers the deployment of ALL recent SMS system changes:

1. **ClickSend Status Fix** - Display actual ClickSend API statuses instead of generic "sent"
2. **Admin Notification System** - Role-based SMS notifications for admins vs. subcontractors

## Prerequisites

- Supabase project with CLI access
- ClickSend account credentials configured
- Admin access to the application

---

## Part 1: ClickSend Status Fix Deployment

### What This Fixes
- SMS logs now show the actual ClickSend status (e.g., "SUCCESS", "REGISTRATION_NEEDED")
- UI displays appropriate badges and colors for each status
- Database constraint updated to allow any ClickSend status value

### Step 1.1: Apply Database Migration

```bash
# Navigate to project root
cd /Users/timothyfarzalo/Desktop/jg-january-2026

# Apply migration via Supabase CLI
npx supabase db push
```

**OR** manually apply in Supabase SQL Editor:
- Run `/supabase/migrations/20260518000004_allow_clicksend_status_values.sql`

### Step 1.2: Verify Migration

```sql
-- Run in SQL Editor
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'sms_notification_logs_status_check';

-- Expected: check_clause should allow any non-empty string
-- ((status IS NOT NULL) AND (length(trim(BOTH FROM status)) > 0))
```

### Step 1.3: Deploy Edge Function

```bash
# Deploy updated send-sms function
npx supabase functions deploy send-sms

# Verify deployment
npx supabase functions list
```

###Step 1.4: Test Status Display

1. Send a test SMS (use a trial account number if possible)
2. Check Admin → App Settings → SMS Logs
3. Verify status shows actual ClickSend response (e.g., "REGISTRATION_NEEDED" for trial numbers)

---

## Part 2: Admin Notification System Deployment

### What This Adds
- Admins receive SMS for system-wide events (any subcontractor action)
- Subcontractors only receive SMS for their assigned jobs
- Chat messages remain direct (specific recipient)

### Step 2.1: Apply Admin Settings Migration

```bash
# Apply migration
npx supabase db push
```

**OR** manually apply in Supabase SQL Editor:
- Run `/supabase/migrations/20260518000005_add_admin_sms_notification_settings.sql`

### Step 2.2: Verify Admin Settings Created

```sql
-- Run in SQL Editor
SELECT 
  p.full_name,
  p.role,
  s.notify_admin_job_accepted,
  s.notify_admin_work_order_submitted,
  s.notify_admin_charges_approved
FROM profiles p
LEFT JOIN user_sms_notification_settings s ON s.user_id = p.id
WHERE p.role IN ('admin', 'is_super_admin', 'jg_management')
ORDER BY p.full_name;

-- Expected: All admins should have these columns set to TRUE
```

### Step 2.3: Deploy Updated Edge Function

```bash
# Deploy updated dispatch-sms-notification function with role-based logic
npx supabase functions deploy dispatch-sms-notification

# Verify deployment
npx supabase functions logs dispatch-sms-notification --tail
```

### Step 2.4: Deploy Frontend Updates

The UI component `SmsNotificationSettings.tsx` needs to be updated to show admin-specific options. This will be done in a separate frontend deployment.

```bash
# Build the React app
npm run build

# Deploy (method depends on your hosting)
# Example for Netlify:
# netlify deploy --prod
```

---

## Testing Plan

### Test 1: Admin Receives System-Wide Notifications

**Setup:**
1. Ensure you have an admin user with SMS enabled
2. Verify admin has a valid phone number and consent given
3. Check that admin notification settings are enabled

**Test Actions:**
1. Have a subcontractor accept a job
2. Have a subcontractor submit a work order
3. Approve extra charges on a job

**Expected Results:**
- Admin receives SMS for each event
- Log shows admin's user_id as recipient
- Status shows ClickSend response (SUCCESS or REGISTRATION_NEEDED)

**SQL Verification:**
```sql
SELECT 
  created_at,
  event_type,
  status,
  phone_last4,
  message_body
FROM sms_notification_logs
WHERE user_id = '<admin_user_id>'
  AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

### Test 2: Subcontractor Only Receives Personal Notifications

**Setup:**
1. Have a subcontractor user with SMS enabled
2. Have another subcontractor user

**Test Actions:**
1. Assign a job to subcontractor A → A should receive SMS
2. Have subcontractor B accept a job → A should NOT receive SMS
3. Send a chat message to subcontractor A → A should receive SMS

**Expected Results:**
- Subcontractor A receives SMS only for events involving them directly
- No SMS for other subcontractors' actions

### Test 3: Chat Messages Are Direct

**Test Actions:**
1. Send a chat message to a specific admin
2. Send a chat message to a specific subcontractor

**Expected Results:**
- Only the specific recipient receives SMS
- Other admins do NOT receive SMS for chat messages
- Sender does NOT receive SMS for their own message

### Test 4: Status Display Accuracy

**Test Actions:**
1. Send SMS to a phone number requiring registration (trial account)
2. Send SMS to a valid registered number

**Expected Results:**
- Trial number shows "REGISTRATION_NEEDED" status (orange badge)
- Valid number shows "SUCCESS" status (green badge)
- No generic "SENT" statuses for new messages

---

## Rollback Procedures

### Rollback Status Fix

If the status migration causes issues:

```sql
-- Revert to old constraint
ALTER TABLE sms_notification_logs
  DROP CONSTRAINT IF EXISTS sms_notification_logs_status_check;

ALTER TABLE sms_notification_logs
  ADD CONSTRAINT sms_notification_logs_status_check
  CHECK (status IN ('queued', 'sent', 'failed', 'skipped', 'simulated'));

-- Convert ClickSend statuses back to generic
UPDATE sms_notification_logs
SET status = 'sent'
WHERE status NOT IN ('queued', 'sent', 'failed', 'skipped', 'simulated')
  AND error_message IS NULL;
```

### Rollback Admin Notifications

If admin notification system causes issues:

```sql
-- Disable admin notifications
UPDATE user_sms_notification_settings
SET 
  notify_admin_job_accepted = false,
  notify_admin_work_order_submitted = false,
  notify_admin_charges_approved = false;

-- Drop the columns (optional)
ALTER TABLE user_sms_notification_settings
  DROP COLUMN IF EXISTS notify_admin_job_accepted,
  DROP COLUMN IF EXISTS notify_admin_work_order_submitted,
  DROP COLUMN IF EXISTS notify_admin_charges_approved;
```

Then redeploy the previous version of the `dispatch-sms-notification` function.

---

## Monitoring

### Key Metrics to Watch

1. **SMS Delivery Rate:**
```sql
SELECT 
  status,
  COUNT(*) as count,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 2) as percentage
FROM sms_notification_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;
```

2. **Admin Notifications:**
```sql
SELECT 
  event_type,
  COUNT(*) as admin_notifications
FROM sms_notification_logs l
JOIN profiles p ON p.id = l.user_id
WHERE p.role IN ('admin', 'is_super_admin', 'jg_management')
  AND l.created_at > NOW() - INTERVAL '24 hours'
  AND l.event_type IN ('job_accepted', 'work_order_submitted', 'charges_approved')
GROUP BY event_type;
```

3. **Error Rate:**
```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) FILTER (WHERE status LIKE '%FAIL%' OR status = 'failed') as failures,
  COUNT(*) as total
FROM sms_notification_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### Edge Function Logs

```bash
# Monitor send-sms logs
npx supabase functions logs send-sms --tail

# Monitor dispatch-sms-notification logs
npx supabase functions logs dispatch-sms-notification --tail

# Look for errors
npx supabase functions logs send-sms | grep -i "error\|fail"
```

---

## Troubleshooting

### Issue: Admins Not Receiving System-Wide Notifications

**Check:**
1. Verify migration applied:
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'user_sms_notification_settings' 
     AND column_name LIKE 'notify_admin%';
   ```

2. Verify admin settings enabled:
   ```sql
   SELECT * FROM user_sms_notification_settings 
   WHERE user_id = '<admin_user_id>';
   ```

3. Check dispatch function logs for role query

### Issue: ClickSend Status Still Showing "SENT"

**Check:**
1. Verify migration applied (see Step 1.2 above)
2. Check send-sms function deployed:
   ```bash
   npx supabase functions list
   ```
3. Test with a fresh SMS send
4. Check logs for database constraint errors

### Issue: Subcontractors Receiving Admin Notifications

**Check:**
1. Verify dispatch function deployed with new logic
2. Check function logs to see which resolution function is being called
3. Verify the event type is mapped correctly in `eventToAdminSettingColumn()`

---

## Success Criteria

✅ **Status Fix:**
- [ ] Migration applied without errors
- [ ] New SMS logs show actual ClickSend status values
- [ ] UI displays appropriate badges for each status
- [ ] No database constraint errors in logs

✅ **Admin Notifications:**
- [ ] Admin users have new notification columns
- [ ] Admin receives SMS when subcontractor accepts job
- [ ] Admin receives SMS when subcontractor submits work order
- [ ] Admin receives SMS when charges approved
- [ ] Subcontractor does NOT receive SMS for other users' actions
- [ ] Chat messages go only to specific recipients

✅ **Overall:**
- [ ] All tests pass
- [ ] No errors in Edge Function logs
- [ ] Users report accurate notification behavior
- [ ] SMS delivery rate remains stable

---

## Related Documentation

- [CLICKSEND_STATUS_REFERENCE.md](./CLICKSEND_STATUS_REFERENCE.md) - Complete status value guide
- [CLICKSEND_STATUS_FIX_DEPLOYMENT.md](./CLICKSEND_STATUS_FIX_DEPLOYMENT.md) - Detailed status fix deployment
- [ADMIN_SMS_NOTIFICATION_REQUIREMENTS.md](./ADMIN_SMS_NOTIFICATION_REQUIREMENTS.md) - Full requirements spec
- [CLICKSEND_TROUBLESHOOTING.md](./CLICKSEND_TROUBLESHOOTING.md) - General troubleshooting guide

---

**Last Updated:** May 18, 2026  
**Migrations:**
- `20260518000004_allow_clicksend_status_values.sql`
- `20260518000005_add_admin_sms_notification_settings.sql`

**Edge Functions:**
- `send-sms` - Updated to store actual ClickSend status
- `dispatch-sms-notification` - Updated with role-based recipient resolution

**UI Components:**
- `SmsNotificationLogs.tsx` - Updated to display ClickSend statuses
- `SmsNotificationSettings.tsx` - Needs update for admin-specific options
