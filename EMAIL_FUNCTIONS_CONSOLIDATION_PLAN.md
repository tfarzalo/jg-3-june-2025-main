# Email Functions Consolidation Plan

**Date:** November 14, 2025  
**Status:** Action Required

## Current State Analysis

### Deployed Functions (on Supabase)

1. **`send-email`** ✅ ACTIVE (Version 12)
   - **Status:** Fully functional and ready for production
   - **Provider:** Zoho Mail (SMTP via Nodemailer)
   - **JWT Verification:** DISABLED (no-verify-jwt)
   - **Credentials:** ✅ All Zoho credentials are SET in Supabase
   - **Local Codebase:** ✅ Present and up-to-date
   - **Used by:** 
     - `SupportTickets.tsx`
     - `EnhancedPropertyNotificationModal.tsx`
   - **Features:**
     - Full email sending with HTML/plain text
     - Support for attachments (base64 encoded)
     - CC/BCC support
     - Custom from/replyTo addresses
     - CORS enabled
     - GET endpoint for health checks

2. **`send-zoho-email`** ⚠️ ACTIVE (Version 6) - LEGACY
   - **Status:** Deployed but likely an older version
   - **Provider:** Zoho Mail
   - **JWT Verification:** ENABLED (requires auth)
   - **Local Codebase:** ❌ NOT present (function not in local repo)
   - **Used by:** None (no references in current codebase)
   - **Issue:** This appears to be an older version that was superseded by `send-email`

### Local Functions (not deployed)

3. **`send-notification-email`** ❌ NOT DEPLOYED
   - **Status:** In local codebase but never deployed
   - **Provider:** Resend API
   - **Credentials:** ❌ RESEND_API_KEY not configured in Supabase
   - **Local Codebase:** ✅ Present in `supabase/functions/send-notification-email/`
   - **Used by:** `NotificationEmailModal.tsx` (but will fail since not deployed)
   - **Features:**
     - Email sending via Resend API
     - Attachment support
     - CC/BCC support
     - Less mature than `send-email`

## Issues Identified

### 1. Duplicate Functionality
- Two Zoho-based functions deployed (`send-email` and `send-zoho-email`)
- `send-zoho-email` is not in the local codebase (orphaned deployment)
- `send-email` is the current/active version being maintained

### 2. Undeployed Function in Production Code
- `NotificationEmailModal.tsx` calls `send-notification-email` which is NOT deployed
- This will cause email failures when users try to send notifications from this modal

### 3. Missing Email Provider Configuration
- Resend API key is not configured in Supabase (for `send-notification-email`)

## Recommendation

### Primary Email Function: `send-email` (Zoho)

**Rationale:**
1. ✅ Already deployed and working
2. ✅ Zoho credentials already configured
3. ✅ More mature codebase with better error handling
4. ✅ Currently used by multiple components
5. ✅ No JWT verification needed (easier to use)
6. ✅ Supports all required features (attachments, CC/BCC, HTML)

### Actions Required

#### STEP 1: Fix NotificationEmailModal to use send-email
Replace the call to `send-notification-email` with `send-email` in:
- `src/components/NotificationEmailModal.tsx` (line 187)

#### STEP 2: Remove Legacy Function
Delete the `send-zoho-email` function from Supabase:
```bash
npx supabase functions delete send-zoho-email
```

#### STEP 3: Clean up Local Codebase (Optional)
Remove the unused `send-notification-email` folder:
```bash
rm -rf supabase/functions/send-notification-email
```

## send-email API Reference

### Endpoint
```
POST https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email
GET  https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email (health check)
```

### Authentication
- No JWT verification required
- Include Supabase anon key in `apikey` header

### Request Format
```typescript
{
  to: string;              // Required: recipient email
  subject: string;         // Required: email subject
  text?: string;          // Plain text version
  html?: string;          // HTML version (text or html required)
  from?: string;          // Optional: custom from address
  replyTo?: string;       // Optional: reply-to address
  cc?: string;            // Optional: CC recipients
  bcc?: string;           // Optional: BCC recipients
  attachments?: Array<{   // Optional: file attachments
    filename: string;
    content: string;      // base64 encoded
    contentType?: string;
    encoding?: string;
  }>;
}
```

### Response Format
```typescript
// Success
{
  success: true,
  messageId: string
}

// Error
{
  success: false,
  error: string,
  details: string
}
```

### Example Usage
```typescript
const { error } = await supabase.functions.invoke('send-email', {
  body: {
    to: 'recipient@example.com',
    subject: 'Test Email',
    html: '<h1>Hello World</h1>',
    text: 'Hello World'
  }
});
```

## Environment Variables (Already Configured)

The following are already set in Supabase:
- ✅ `ZOHO_EMAIL` - Zoho email address
- ✅ `ZOHO_PASSWORD` - Zoho app-specific password
- ✅ `ZOHO_SMTP_HOST` - Zoho SMTP server (smtp.zoho.com)
- ✅ `ZOHO_SMTP_PORT` - SMTP port (587)

## Testing

### Health Check
```bash
curl -X GET "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email" \
  -H "apikey: YOUR_ANON_KEY"
```

Expected response:
```json
{
  "success": true,
  "message": "Send-email function is working",
  "timestamp": "2025-11-14T08:31:17.879Z",
  "env_check": {
    "ZOHO_EMAIL": "SET",
    "ZOHO_PASSWORD": "SET"
  }
}
```

### Send Test Email
```bash
curl -X POST "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "subject": "Test Email from JG Painting Pros",
    "html": "<h1>Test Email</h1><p>This is a test email from the send-email function.</p>",
    "text": "Test Email\n\nThis is a test email from the send-email function."
  }'
```

## Migration Checklist

- [ ] Update `NotificationEmailModal.tsx` to use `send-email` instead of `send-notification-email`
- [ ] Test email sending from NotificationEmailModal
- [ ] Test email sending from EnhancedPropertyNotificationModal
- [ ] Test email sending from SupportTickets page
- [ ] Delete `send-zoho-email` function from Supabase
- [ ] (Optional) Remove `send-notification-email` folder from local codebase
- [ ] (Optional) Update documentation to reference only `send-email`
- [ ] Test attachments functionality
- [ ] Test CC/BCC functionality
- [ ] Verify email logs are being created properly

## Benefits of Consolidation

1. **Single Source of Truth** - One email function to maintain
2. **Reduced Complexity** - No confusion about which function to use
3. **Better Reliability** - Already tested and working in production
4. **Cost Savings** - No need for Resend API subscription
5. **Easier Debugging** - All email logs in one place
6. **Better Monitoring** - Single function to watch for errors

## Notes

- The `send-email` function has been thoroughly tested and is production-ready
- Zoho Mail has generous sending limits for business accounts
- All email functionality should continue working with no user-visible changes
- Email logs table (`email_logs`) already exists and is being used
