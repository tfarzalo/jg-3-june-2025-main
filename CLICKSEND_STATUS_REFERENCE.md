# ClickSend SMS Status Reference

## Overview
This document explains the different SMS status values you'll see in the Admin → App Settings → SMS Logs section, what they mean, and what actions (if any) are required.

## Status Values

### ✅ Success Statuses (Green Badge)

#### `SUCCESS`
- **Meaning:** ClickSend has queued/sent the message successfully
- **Action:** None - message is being delivered
- **Badge:** Green with checkmark icon
- **Common:** This is the most common status for successful sends

#### `sent` (Legacy)
- **Meaning:** Old generic "sent" status from before ClickSend migration
- **Action:** None - message was sent via old Twilio system
- **Badge:** Green with checkmark icon
- **Note:** These are historical records; new messages will use ClickSend statuses

---

### ⚠️ Registration/Warning Statuses (Orange/Yellow Badge)

#### `REGISTRATION_NEEDED`
- **Meaning:** Phone number must be registered with ClickSend (trial account limitation)
- **Action Required:** 
  1. Log in to ClickSend dashboard
  2. Go to Settings → Sender IDs
  3. Register the recipient's phone number
  4. Wait for approval (usually instant for trial accounts)
- **Badge:** Orange with warning triangle icon
- **Common on:** Trial/development ClickSend accounts
- **Documentation:** [ClickSend Trial Account Limits](https://developers.clicksend.com/docs/rest/v3/#trial-accounts)

#### `OPTED_OUT`
- **Meaning:** Recipient has opted out of receiving SMS from your number
- **Action Required:** 
  - Recipient must opt back in by texting "START" or "UNSTOP"
  - Do NOT manually re-enable; this violates SMS compliance
- **Badge:** Yellow with minus circle icon
- **Legal Note:** Sending to opted-out numbers violates TCPA regulations

#### `skipped`
- **Meaning:** Message was not sent due to user settings (SMS disabled in profile)
- **Action:** Check user's SMS notification settings in their profile
- **Badge:** Yellow with minus circle icon
- **Common:** User has turned off SMS notifications

---

### ❌ Failure Statuses (Red Badge)

#### `INVALID_NUMBER`
- **Meaning:** Phone number format is invalid or doesn't exist
- **Action Required:**
  1. Verify phone number is in E.164 format (+1XXXXXXXXXX)
  2. Check that the number is valid and active
  3. Update user's phone number in their profile
- **Badge:** Red with X icon
- **Common Causes:** Typos, disconnected numbers, wrong country code

#### `CARRIER_FAILURE`
- **Meaning:** The mobile carrier rejected the message
- **Action:** Try a different number or contact the carrier
- **Badge:** Red with X icon
- **Rare:** Usually indicates carrier-level blocking

#### `failed`
- **Meaning:** Network error or API failure when attempting to send
- **Action Required:**
  1. Check ClickSend API credentials are correct
  2. Verify ClickSend account has available credits
  3. Check Edge Function logs for detailed error
- **Badge:** Red with X icon
- **Check:** Supabase Edge Function logs for detailed error messages

---

### ℹ️ Internal/Testing Statuses (Gray/Purple Badge)

#### `queued`
- **Meaning:** Message is queued and waiting to be sent to ClickSend
- **Action:** None - this is temporary, should update within seconds
- **Badge:** Gray with clock icon
- **Note:** If stuck in "queued" for >5 minutes, check Edge Function logs

#### `simulated`
- **Meaning:** Test/dry-run mode - message was NOT actually sent
- **Action:** None - this is intentional for testing
- **Badge:** Purple with flask icon
- **When:** Used when `dry_run: true` flag is set in API call

---

## Troubleshooting by Status

### "Why aren't my messages being delivered?"

1. **Check the status column** - this tells you exactly why
2. **Look for error messages** - click row to see full error details
3. **Common issues:**
   - `REGISTRATION_NEEDED` → Register phone in ClickSend dashboard
   - `INVALID_NUMBER` → Fix phone number format
   - `OPTED_OUT` → User must opt back in (cannot be forced)
   - `failed` → Check API credentials and account credits
   - `skipped` → Enable SMS in user's notification settings

### "How do I register a phone number?" (REGISTRATION_NEEDED)

**For Trial Accounts:**
1. Go to [ClickSend Dashboard](https://dashboard.clicksend.com/)
2. Navigate to **Settings** → **Sender IDs**
3. Click **Add Sender ID**
4. Enter the phone number (include +1 for US)
5. Submit for approval (usually instant for trial)

**For Production Accounts:**
Registration is not required - messages go through immediately.

### "Status shows SUCCESS but user didn't receive message"

Possible causes:
1. **Carrier delay** - can take 1-5 minutes for delivery
2. **Phone is off** or out of service
3. **Number is actually invalid** (ClickSend couldn't verify yet)
4. **Carrier spam filter** blocked it

Check the **Delivery Reports** in ClickSend dashboard for final delivery status.

---

## Status Flow Diagram

```
User triggers SMS
      ↓
[ queued ] ← Initial status before API call
      ↓
   API Call to ClickSend
      ↓
   ┌─────────────┐
   │ API Success? │
   └─────────────┘
        ↙      ↘
     YES        NO
      ↓         ↓
  SUCCESS    failed
  (or other  (network error,
   ClickSend  API rejected)
   status)
      ↓
   Delivery
   (tracked by
    ClickSend
    webhooks)
```

---

## Admin UI Reference

### Status Badge Colors

| Color | Meaning | Example Statuses |
|-------|---------|------------------|
| 🟢 Green | Success/Delivered | SUCCESS, sent |
| 🟠 Orange | Action Required | REGISTRATION_NEEDED |
| 🟡 Yellow | Warning/Skipped | OPTED_OUT, skipped |
| 🔴 Red | Failed/Error | INVALID_NUMBER, CARRIER_FAILURE, failed |
| ⚫ Gray | Pending | queued |
| 🟣 Purple | Test/Simulated | simulated |

### Filtering Logs

Use the **Filter by Status** dropdown to view:
- All statuses
- Only successful messages
- Only failures
- Only pending/queued messages

### Search Functionality

Search logs by:
- Recipient name
- Recipient email
- Message content (partial match)

---

## Database Reference

### Table: `sms_notification_logs`

Key columns:
- `status` - The current status (stores actual ClickSend response)
- `provider_status` - Original status from ClickSend API (for reference)
- `error_message` - Detailed error if `status = 'failed'`
- `skip_reason` - Reason if `status = 'skipped'`
- `delivered_at` - Timestamp when delivery was confirmed (webhook)
- `failed_at` - Timestamp when delivery failed (webhook)

### Status Constraint

```sql
-- Current constraint (allows any ClickSend status)
CHECK (status IS NOT NULL AND length(trim(status)) > 0)
```

This allows storing any non-empty string, giving us precise ClickSend status information.

---

## ClickSend API Documentation

For complete list of status values:
- [ClickSend SMS API Docs](https://developers.clicksend.com/docs/rest/v3/#send-sms)
- [ClickSend Status Codes](https://developers.clicksend.com/docs/rest/v3/#status-codes)
- [ClickSend Trial Limits](https://developers.clicksend.com/docs/rest/v3/#trial-accounts)

---

## Quick Actions

### Test SMS Sending
```bash
# Via Supabase CLI
npx supabase functions invoke send-sms --data '{
  "to": "+1234567890",
  "body": "Test message",
  "event_type": "test",
  "dry_run": true
}'
```

### Check Recent Statuses
```sql
SELECT status, COUNT(*) as count
FROM sms_notification_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status
ORDER BY count DESC;
```

### Find Failed Messages
```sql
SELECT 
  created_at,
  phone_last4,
  status,
  error_message,
  message_body
FROM sms_notification_logs
WHERE status = 'failed'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

---

**Last Updated:** May 18, 2026  
**Related Documentation:**
- [CLICKSEND_STATUS_FIX_DEPLOYMENT.md](./CLICKSEND_STATUS_FIX_DEPLOYMENT.md)
- [CLICKSEND_MIGRATION_GUIDE.md](./CLICKSEND_MIGRATION_GUIDE.md)
- [CLICKSEND_TROUBLESHOOTING.md](./CLICKSEND_TROUBLESHOOTING.md)
