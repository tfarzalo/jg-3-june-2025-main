# ClickSend Edge Functions - Code Summary

## ✅ **All Edge Functions Created/Updated**

I've already created and updated all necessary edge functions for ClickSend. Here's what exists:

---

## 📁 **Files Created/Modified**

### **1. NEW: `/supabase/functions/handle-clicksend-delivery/index.ts`**

**Status:** ✅ **CREATED** (190 lines)

**Purpose:** Webhook handler for ClickSend delivery receipts

**Key Features:**
- Receives POST webhooks from ClickSend
- Parses form-encoded callback data
- Extracts: `message_id`, `status`, `error_code`, `error_text`, `timestamp`
- Updates `sms_notification_logs` table with delivery status
- Handles statuses: Sent, Delivered, Failed, Undelivered
- Always returns 200 OK (ClickSend retries on errors)

**Webhook URL:**
```
https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/handle-clicksend-delivery
```

---

### **2. UPDATED: `/supabase/functions/send-sms/index.ts`**

**Status:** ✅ **UPDATED** (376 lines)

**Changes Made:**
- ❌ Removed: Twilio API calls
- ✅ Added: ClickSend REST API integration
- ✅ Changed: Authentication from `SID:Token` to `Username:API_Key`
- ✅ Changed: Request format from form-encoded to JSON
- ✅ Changed: Response parsing for ClickSend format
- ✅ Updated: Max message length from 1600 to 1224 chars
- ✅ Updated: Documentation and comments

**Required Secrets:**
```
CLICKSEND_USERNAME
CLICKSEND_API_KEY
CLICKSEND_SOURCE
```

**API Endpoint:**
```
POST https://rest.clicksend.com/v3/sms/send
```

---

### **3. UPDATED: `/supabase/functions/dispatch-sms-notification/index.ts`**

**Status:** ✅ **UPDATED** (documentation only)

**Changes:**
- Updated comments to reference ClickSend instead of Twilio
- No functional changes (calls `send-sms` which handles the actual API)

---

## 🔧 **How the System Works**

### **SMS Sending Flow:**

```
1. User Action (e.g., job assigned)
          ↓
2. dispatchSmsNotification() called from client
          ↓
3. dispatch-sms-notification Edge Function
   - Validates user settings
   - Renders message template
   - Inserts into sms_notification_queue
          ↓
4. process-sms-queue Edge Function (runs periodically)
   - Reads pending queue items
   - Calls send-sms for each
          ↓
5. send-sms Edge Function ← YOU ARE HERE
   - Calls ClickSend REST API
   - Logs to sms_notification_logs
   - Returns message_id
          ↓
6. ClickSend delivers SMS
          ↓
7. ClickSend sends delivery receipt webhook
          ↓
8. handle-clicksend-delivery Edge Function ← YOU ARE HERE
   - Updates log with final status
```

---

## 📝 **Code Comparison: Twilio vs ClickSend**

### **Send SMS - API Call**

**Before (Twilio):**
```typescript
// Twilio endpoint
const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;

// Form-encoded body
const formBody = new URLSearchParams({
  To: to,
  From: TWILIO_PHONE_NUMBER,
  Body: body,
  StatusCallback: statusCallbackUrl,
});

// POST with form encoding
const twilioRes = await fetch(twilioUrl, {
  method: "POST",
  headers: {
    Authorization: `Basic ${btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`)}`,
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  },
  body: formBody.toString(),
});

// Response
{
  "sid": "SM1234567890abcdef",
  "status": "queued",
  ...
}
```

**After (ClickSend):**
```typescript
// ClickSend endpoint
const clickSendUrl = "https://rest.clicksend.com/v3/sms/send";

// JSON body
const requestBody = {
  messages: [{
    source: CLICKSEND_SOURCE,
    to: to,
    body: body,
    custom_string: queuedLogId, // Track back to our log
  }]
};

// POST with JSON
const clickSendRes = await fetch(clickSendUrl, {
  method: "POST",
  headers: {
    Authorization: `Basic ${btoa(`${USERNAME}:${API_KEY}`)}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(requestBody),
});

// Response
{
  "http_code": 200,
  "response_code": "SUCCESS",
  "data": {
    "messages": [{
      "message_id": "BF8A6E93-FADC-4587-99C5-07AB01F2F417",
      "status": "SUCCESS",
      ...
    }]
  }
}
```

---

### **Delivery Receipt Handler**

**Before (Twilio):**
```typescript
// File: handle-twilio-status/index.ts
// Webhook receives form data with:
// MessageSid, MessageStatus, ErrorCode, ErrorMessage

const messageSid = formData.get("MessageSid");
const status = formData.get("MessageStatus");
const errorCode = formData.get("ErrorCode");

// Update log
await supabase
  .from("sms_notification_logs")
  .update({
    provider_status: status,
    error_message: errorMessage,
  })
  .eq("provider_message_sid", messageSid);
```

**After (ClickSend):**
```typescript
// File: handle-clicksend-delivery/index.ts
// Webhook receives form data with:
// message_id, status, error_code, error_text

const messageId = formData.get("message_id");
const status = formData.get("status");
const errorCode = formData.get("error_code");

// Update log
await supabase
  .from("sms_notification_logs")
  .update({
    provider_status: status,
    error_message: `ClickSend: ${errorMessage}`,
  })
  .eq("provider_message_sid", messageId);
```

---

## 🚀 **Deployment Commands**

To deploy these edge functions to Supabase, run:

```bash
cd /Users/timothyfarzalo/Desktop/jg-january-2026

# Deploy the updated SMS sender
supabase functions deploy send-sms

# Deploy the NEW ClickSend webhook handler
supabase functions deploy handle-clicksend-delivery

# Redeploy the dispatcher (uses updated send-sms)
supabase functions deploy dispatch-sms-notification
```

**Expected Output:**
```
Deploying function send-sms...
✓ Function send-sms deployed successfully

Deploying function handle-clicksend-delivery...
✓ Function handle-clicksend-delivery deployed successfully

Deploying function dispatch-sms-notification...
✓ Function dispatch-sms-notification deployed successfully
```

---

## ⚙️ **Configuration Required**

### **1. Add Secrets to Supabase**

**Via Dashboard:**
1. Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Add these three secrets:

```
CLICKSEND_USERNAME = your_clicksend_username
CLICKSEND_API_KEY = your_clicksend_api_key
CLICKSEND_SOURCE = JGManagement
```

**Via CLI:**
```bash
supabase secrets set CLICKSEND_USERNAME="your_username"
supabase secrets set CLICKSEND_API_KEY="your_api_key"
supabase secrets set CLICKSEND_SOURCE="JGManagement"
```

### **2. Configure ClickSend Webhook**

1. Log into ClickSend Dashboard
2. Go to **Developers** → **Webhooks**
3. Click **Add Webhook**
4. Select **SMS Delivery Receipts**
5. Enter webhook URL:
   ```
   https://YOUR-PROJECT-REF.supabase.co/functions/v1/handle-clicksend-delivery
   ```
6. Save

---

## 🧪 **Testing the Functions**

### **Test send-sms directly:**

```bash
curl -X POST \
  "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-sms" \
  -H "Authorization: Bearer YOUR-ANON-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+12025551234",
    "body": "Test message from ClickSend!",
    "event_type": "direct",
    "dry_run": false
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "provider_message_sid": "BF8A6E93-FADC-4587-99C5-07AB01F2F417",
  "provider_status": "SUCCESS",
  "log_id": "uuid-here"
}
```

### **Test webhook handler:**

After sending an SMS, ClickSend will automatically call your webhook. Check logs:

```bash
supabase functions logs handle-clicksend-delivery
```

You should see:
```
[clicksend-delivery] === WEBHOOK RECEIVED ===
[clicksend-delivery] 📬 message_id=... | status=Delivered | ...
[clicksend-delivery] ✅ Updated | log_id=... | status=Delivered
```

---

## 📊 **Function Summary**

| Function | Status | Purpose | Lines | Changes |
|----------|--------|---------|-------|---------|
| `send-sms` | ✅ Updated | Send SMS via ClickSend | 376 | Major (API switch) |
| `handle-clicksend-delivery` | ✅ NEW | Receive delivery receipts | 190 | New file |
| `dispatch-sms-notification` | ✅ Updated | Event dispatcher | 574 | Docs only |
| `process-sms-queue` | ✅ No change | Queue processor | - | Works as-is |

---

## ✅ **What's Already Done**

- ✅ Edge function code written
- ✅ ClickSend API integration complete
- ✅ Delivery receipt handler created
- ✅ Error handling implemented
- ✅ Logging and monitoring ready
- ✅ Documentation updated

---

## 🎯 **What You Need to Do**

1. ✅ Get ClickSend account credentials
2. ✅ Add secrets to Supabase
3. ✅ Deploy the 3 functions (commands above)
4. ✅ Configure webhook in ClickSend
5. ✅ Test with your phone number

---

## 🔍 **Verify Deployment**

After deploying, verify the functions exist:

```bash
supabase functions list
```

Expected output:
```
┌──────────────────────────────┬──────────┬─────────────┐
│ NAME                         │ STATUS   │ CREATED AT  │
├──────────────────────────────┼──────────┼─────────────┤
│ send-sms                     │ ACTIVE   │ ...         │
│ handle-clicksend-delivery    │ ACTIVE   │ ...         │
│ dispatch-sms-notification    │ ACTIVE   │ ...         │
└──────────────────────────────┴──────────┴─────────────┘
```

---

**Status:** ✅ All code created and ready to deploy!  
**Next Step:** Follow `CLICKSEND_QUICK_START.md` to complete setup  
