# Email Functions Analysis & Activation Guide
**Date:** November 14, 2025  
**Status:** 📧 Ready to activate

## 📊 Summary

You have **TWO email Edge Functions** in your codebase:

| Function | Provider | Status | Recommendation |
|----------|----------|--------|----------------|
| **send-email** | Zoho Mail (SMTP) | ✅ Deployed | **USE THIS ONE** |
| **send-notification-email** | Resend API | ❌ Not deployed | Remove |

---

## 🎯 RECOMMENDATION: **Use send-email (Zoho SMTP)**

### Why Choose send-email?

✅ **More Complete Implementation:**
- Full attachment support (base64 encoded)
- Connection verification before sending
- Test endpoint to check credentials
- Detailed error logging
- Both HTML and plain text support

✅ **Easier to Setup:**
- Just needs Zoho email credentials
- No domain verification required
- Works with any Zoho Mail account

✅ **Cost Effective:**
- Free with Zoho Mail account
- No API fees

✅ **Already Deployed:**
- Function is live on Supabase
- Just needs environment variables

---

## 🚀 ACTIVATION STEPS

### Step 1: Get Zoho Credentials

**Option A: Use Existing Zoho Email**
- Email: `your-email@yourdomain.com`
- Password: Your Zoho password

**Option B: Create App-Specific Password (Recommended)**
1. Log into Zoho Mail
2. Go to Settings → Security
3. Enable Two-Factor Authentication (if not enabled)
4. Navigate to "App Passwords"
5. Click "Generate New Password"
6. Name it "Supabase Edge Functions"
7. Copy the generated password

### Step 2: Set Environment Variables in Supabase

**Via Supabase Dashboard:**
1. Go to: https://supabase.com/dashboard/project/tbwtfimnbmvbgesidbxh
2. Navigate to: Settings → Edge Functions → Secrets
3. Add these secrets:
   ```
   ZOHO_EMAIL=your-email@yourdomain.com
   ZOHO_PASSWORD=your-app-specific-password-or-regular-password
   ```

**Via CLI (if you prefer):**
```bash
cd "/Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main - September 2025"

npx supabase secrets set ZOHO_EMAIL=your-email@yourdomain.com
npx supabase secrets set ZOHO_PASSWORD=your-password
```

### Step 3: Redeploy with JWT Verification Disabled

The function is already deployed but needs to allow unauthenticated access (like calendar-feed):

```bash
cd "/Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main - September 2025"

npx supabase functions deploy send-email --no-verify-jwt
```

### Step 4: Test the Function

**Check if credentials are set:**
```bash
curl "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email"
```

Expected response:
```json
{
  "success": true,
  "message": "Send-email function is working",
  "env_check": {
    "ZOHO_EMAIL": "SET",
    "ZOHO_PASSWORD": "SET"
  }
}
```

**Send a test email:**
```bash
curl -X POST "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-test-email@example.com",
    "subject": "Test Email from JG Painting Pros",
    "text": "This is a test email.",
    "html": "<h1>Test Email</h1><p>This is a test email from JG Painting Pros.</p>"
  }'
```

Expected response:
```json
{
  "success": true,
  "messageId": "some-message-id"
}
```

---

## 🗑️ REMOVE send-notification-email

Since `send-notification-email` is not deployed and you'll be using `send-email` instead, you can remove it:

```bash
cd "/Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main - September 2025"

# Remove from codebase
rm -rf supabase/functions/send-notification-email

# Commit the change
git add -A
git commit -m "Remove unused send-notification-email function - using send-email (Zoho) instead"
git push origin main
```

---

## 📝 How to Use send-email in Your Application

### Basic Email:
```typescript
const response = await fetch(
  'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: 'recipient@example.com',
      subject: 'Your Subject',
      html: '<h1>Hello</h1><p>Email content here</p>',
      text: 'Plain text version'
    })
  }
);
```

### Email with Attachments:
```typescript
const response = await fetch(
  'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: 'recipient@example.com',
      subject: 'Email with Attachment',
      html: '<p>Please see attached file</p>',
      attachments: [
        {
          filename: 'document.pdf',
          content: 'base64-encoded-content-here',
          contentType: 'application/pdf',
          encoding: 'base64'
        }
      ]
    })
  }
);
```

### Email with CC/BCC:
```typescript
const response = await fetch(
  'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: 'recipient@example.com',
      cc: 'manager@example.com',
      bcc: 'admin@example.com',
      subject: 'Your Subject',
      html: '<p>Email content</p>'
    })
  }
);
```

---

## 🔧 Troubleshooting

### Issue: "Zoho Mail credentials not configured"
**Solution:** Set ZOHO_EMAIL and ZOHO_PASSWORD environment variables in Supabase Dashboard

### Issue: "SMTP connection failed"
**Solutions:**
- Verify Zoho email and password are correct
- If using 2FA, use an App-Specific Password
- Check if Zoho account is active and not suspended
- Verify SMTP is enabled in Zoho Mail settings

### Issue: "Authentication failed"
**Solutions:**
- Double-check password (no extra spaces)
- Try creating a new App-Specific Password
- Ensure 2FA is properly configured if using app passwords

### Issue: Emails going to spam
**Solutions:**
- Use a verified Zoho domain
- Add SPF and DKIM records to your domain
- Include proper from/reply-to addresses
- Avoid spam trigger words in subject/content

---

## 📋 Checklist

Before marking as complete, ensure:

- [ ] Zoho Mail account is set up and accessible
- [ ] ZOHO_EMAIL environment variable is set in Supabase
- [ ] ZOHO_PASSWORD environment variable is set in Supabase
- [ ] send-email function is redeployed with `--no-verify-jwt`
- [ ] Test GET request shows credentials are SET
- [ ] Test POST request successfully sends email
- [ ] Test email arrives in inbox (check spam folder)
- [ ] send-notification-email folder is removed from codebase
- [ ] Changes are committed and pushed to main branch

---

## 🎉 Once Activated

Your application will be able to:
- ✅ Send transactional emails (receipts, confirmations)
- ✅ Send notification emails (job updates, alerts)
- ✅ Send emails with attachments (invoices, PDFs)
- ✅ Send emails with CC/BCC
- ✅ Customize sender name and reply-to address
- ✅ Track email delivery with message IDs

**Next steps after activation:**
1. Integrate email sending into your application workflows
2. Create email templates for common scenarios
3. Set up email logging/tracking in your database
4. Monitor email delivery rates and handle failures
