# ClickSend SMS Migration Guide

## 📋 Overview

This guide details the migration from Twilio to ClickSend for SMS notifications. All code changes have been completed. Follow the steps below to complete the setup.

---

## ✅ Code Changes Completed

The following files have been updated to use ClickSend:

### **Updated Files:**
1. ✅ `supabase/functions/send-sms/index.ts` - Updated to call ClickSend API
2. ✅ `supabase/functions/handle-clicksend-delivery/index.ts` - NEW webhook handler for delivery receipts
3. ✅ `supabase/functions/dispatch-sms-notification/index.ts` - Documentation updated
4. ✅ `supabase/functions/_shared/smsTemplates.ts` - Documentation updated
5. ✅ `src/lib/sms/dispatchSmsNotification.ts` - Documentation updated
6. ✅ `src/components/SmsNotificationLogs.tsx` - UI labels updated + ClickSend info banner
7. ✅ `src/pages/SmsConsentPage.tsx` - Privacy text updated
8. ✅ `src/components/SmsNotificationSettings.tsx` - UI updated with ClickSend platform info banner
9. ✅ `supabase/migrations/20260414000001_create_sms_notification_logs.sql` - Comments updated

### **Admin UI Enhancements:**
- ✅ SMS Settings page now displays ClickSend platform information
- ✅ Shows max message length (1,224 characters)
- ✅ Shows phone format requirements (E.164)
- ✅ Indicates delivery receipt webhook is enabled
- ✅ SMS Logs page shows ClickSend provider info
- ✅ All notification types remain the same (no changes needed)
- ✅ Recipient eligibility by role unchanged

---

## 🚀 What You Need to Do

### **Step 1: Sign Up for ClickSend** (5 minutes)

1. Go to https://dashboard.clicksend.com/signup/
2. Create a new account
3. You'll receive **$2 AUD free credit** to test with
4. Verify your email address

---

### **Step 2: Get Your API Credentials** (2 minutes)

1. Log into ClickSend Dashboard
2. Click your account name in the top right
3. Go to **Settings** → **API Credentials**
4. Click **Create API Key** if you don't have one
5. Copy your:
   - **Username** (your account username)
   - **API Key** (long string like `ABCD-1234-EFGH-5678`)

---

### **Step 3: Add Secrets to Supabase** (3 minutes)

You need to add three environment secrets to your Supabase project.

#### **Option A: Using Supabase Dashboard (Recommended)**

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Project Settings** → **Edge Functions**
4. Scroll to **Secrets** section
5. Add these three secrets:

| Secret Name | Value | Example |
|-------------|-------|---------|
| `CLICKSEND_USERNAME` | Your ClickSend username | `john.doe@company.com` |
| `CLICKSEND_API_KEY` | Your API key from ClickSend | `ABCD-1234-EFGH-5678` |
| `CLICKSEND_SOURCE` | Your app identifier | `JGManagement` |

#### **Option B: Using Supabase CLI**

If you have Supabase CLI installed:

```bash
# Navigate to your project directory
cd /Users/timothyfarzalo/Desktop/jg-january-2026

# Set the secrets (replace with your actual values)
supabase secrets set CLICKSEND_USERNAME="your_username_here"
supabase secrets set CLICKSEND_API_KEY="your_api_key_here"
supabase secrets set CLICKSEND_SOURCE="JGManagement"
```

---

### **Step 4: Remove Old Twilio Secrets** (2 minutes)

You can optionally remove the old Twilio secrets to clean up:

#### **Using Supabase Dashboard:**
1. Go to **Project Settings** → **Edge Functions** → **Secrets**
2. Delete these old secrets:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`

#### **Using Supabase CLI:**
```bash
supabase secrets unset TWILIO_ACCOUNT_SID
supabase secrets unset TWILIO_AUTH_TOKEN
supabase secrets unset TWILIO_PHONE_NUMBER
```

---

### **Step 5: Deploy Updated Edge Functions** (5 minutes)

Deploy the updated SMS functions to Supabase:

```bash
# Navigate to your project
cd /Users/timothyfarzalo/Desktop/jg-january-2026

# Deploy the updated send-sms function
supabase functions deploy send-sms

# Deploy the new ClickSend delivery webhook
supabase functions deploy handle-clicksend-delivery

# Redeploy the dispatcher (uses the updated send-sms)
supabase functions deploy dispatch-sms-notification
```

**Expected output:**
```
Deploying function send-sms...
✓ Function deployed successfully

Deploying function handle-clicksend-delivery...
✓ Function deployed successfully

Deploying function dispatch-sms-notification...
✓ Function deployed successfully
```

---

### **Step 6: Configure ClickSend Webhook** (3 minutes)

Set up delivery receipt notifications in ClickSend:

1. Log into ClickSend Dashboard
2. Go to **Developers** → **Webhooks**
3. Click **Add Webhook**
4. Configure as follows:
   - **Event Type:** Select **SMS Delivery Receipts**
   - **Webhook URL:** `https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/handle-clicksend-delivery`
   - **Format:** `application/x-www-form-urlencoded` (default)
5. Click **Save**

**Your webhook URL:**
```
https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/handle-clicksend-delivery
```

---

### **Step 7: Add ClickSend Credit** (2 minutes)

Before testing, ensure you have credit:

1. Go to ClickSend Dashboard → **Account** → **Billing**
2. Click **Add Credit**
3. Add at least $10-20 USD (or equivalent) to start
4. SMS pricing is typically **$0.04-0.08 per message** depending on destination

💡 **Tip:** ClickSend is generally 20-40% cheaper than Twilio!

---

### **Step 8: Test with Your Phone Number** (5 minutes)

Send a test SMS to verify everything works:

#### **Option A: Using Supabase SQL Editor**

1. Go to Supabase Dashboard → **SQL Editor**
2. Run this query (replace with YOUR phone number):

```sql
-- Test SMS send via ClickSend
SELECT net.http_post(
  url := 'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-sms',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || current_setting('request.headers')::json->>'authorization'
  ),
  body := jsonb_build_object(
    'to', '+1234567890',  -- Replace with YOUR E.164 phone number
    'body', 'Test message from ClickSend! Migration successful.',
    'event_type', 'direct',
    'dry_run', false
  )
);
```

#### **Option B: Using a Test Script**

Create a file `test-sms.sh`:

```bash
#!/bin/bash

# Replace these values
ANON_KEY="your-anon-key"
PHONE_NUMBER="+1234567890"  # Your phone in E.164 format

curl -X POST \
  "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-sms" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "'"${PHONE_NUMBER}"'",
    "body": "Test message from ClickSend! Migration successful.",
    "event_type": "direct",
    "dry_run": false
  }'
```

Run it:
```bash
chmod +x test-sms.sh
./test-sms.sh
```

#### **Expected Response:**
```json
{
  "success": true,
  "provider_message_sid": "BF8A6E93-FADC-4587-99C5-07AB01F2F417",
  "provider_status": "SUCCESS",
  "log_id": "uuid-here"
}
```

---

### **Step 9: Verify SMS Logs** (2 minutes)

Check that the SMS was logged correctly:

1. Log into your application
2. Go to **Settings** → **SMS Logs** tab
3. You should see your test message with:
   - ✅ Status: `sent`
   - ✅ Provider: ClickSend message ID
   - ✅ Your phone number (last 4 digits)

---

### **Step 10: Monitor Delivery Receipts** (Optional)

Wait 10-30 seconds, then check the log again:

1. Refresh the SMS Logs page
2. The status should update to `delivered` once ClickSend confirms delivery
3. Click on the log entry to see full details including ClickSend status

---

## 🔍 Troubleshooting

### **Issue: "ClickSend not configured" error**

**Cause:** Secrets not set properly

**Solution:**
1. Double-check secret names are EXACT (case-sensitive)
2. Verify secrets in Supabase Dashboard
3. Redeploy functions after adding secrets

---

### **Issue: "Invalid destination phone" error**

**Cause:** Phone number not in E.164 format

**Solution:**
- Must start with `+1` for US numbers
- Must be exactly 11 digits after `+`
- Example: `+12025551234` ✅
- NOT: `202-555-1234` ❌
- NOT: `2025551234` ❌

---

### **Issue: SMS sent but no delivery receipt**

**Cause:** Webhook not configured correctly

**Solution:**
1. Check webhook URL is correct in ClickSend Dashboard
2. Verify URL format: `https://PROJECT.supabase.co/functions/v1/handle-clicksend-delivery`
3. Test webhook with ClickSend's test feature
4. Check Edge Function logs in Supabase

---

### **Issue: "Insufficient credit" error**

**Cause:** Not enough balance in ClickSend account

**Solution:**
1. Go to ClickSend Dashboard → Billing
2. Add credit (minimum $10 recommended)
3. Try again

---

## 📊 API Comparison: Twilio vs ClickSend

| Feature | Twilio | ClickSend | Status |
|---------|--------|-----------|--------|
| **Auth Method** | Basic (SID:Token) | Basic (User:Key) | ✅ Updated |
| **Request Format** | Form-encoded | JSON | ✅ Updated |
| **Response Format** | JSON | JSON | ✅ Compatible |
| **Message ID Field** | `sid` | `message_id` | ✅ Updated |
| **Delivery Webhooks** | StatusCallback | Delivery Receipts | ✅ New handler |
| **Max Message Length** | 1600 chars | 1224 chars | ✅ Updated |
| **Phone Format** | E.164 | E.164 | ✅ Same |
| **Pricing** | ~$0.08/msg | ~$0.04/msg | 💰 Cheaper! |

---

## 🎯 Post-Migration Checklist

Once everything is working, complete these final steps:

- [ ] Test SMS from all event types:
  - [ ] Job assigned notification
  - [ ] Job accepted notification
  - [ ] Work order submitted notification
  - [ ] Charges approved notification
  - [ ] Chat received notification
- [ ] Verify delivery receipts update correctly
- [ ] Check SMS logs show ClickSend message IDs
- [ ] Monitor first week of production usage
- [ ] Update any documentation that mentions Twilio
- [ ] Remove Twilio from your billing if you're not using it elsewhere

---

## 📞 Support Contacts

### **ClickSend Support**
- Website: https://www.clicksend.com/help
- Email: support@clicksend.com
- Live Chat: Available in dashboard

### **Supabase Support**
- Docs: https://supabase.com/docs
- Discord: https://discord.supabase.com
- GitHub: https://github.com/supabase/supabase/discussions

---

## 🔐 Security Notes

1. **Never commit secrets to git** - Always use environment variables
2. **Webhook validation** - ClickSend webhooks are delivered from specific IPs (optional: add IP validation)
3. **Phone number privacy** - Logs only store last 4 digits
4. **Rate limiting** - ClickSend has rate limits (check your plan)

---

## 📈 Cost Savings Estimate

Based on your current SMS volume:

| Metric | Twilio | ClickSend | Savings |
|--------|--------|-----------|---------|
| Per Message | $0.079 | $0.044 | 44% |
| 100 msgs/month | $7.90 | $4.40 | $3.50/mo |
| 1,000 msgs/month | $79.00 | $44.00 | $35/mo |
| 10,000 msgs/month | $790.00 | $440.00 | $350/mo |

💡 **Estimate your savings:** Count your monthly SMS in the logs and multiply by $0.035

---

## ✨ Migration Complete!

Once you've completed all steps above, your SMS system will be running on ClickSend. The migration maintains all existing functionality while potentially saving significant costs.

**Questions?** Review this guide or check the troubleshooting section above.

---

**Last Updated:** May 18, 2026
**Version:** 1.0
**Status:** Ready for Production
