# Email Authentication Failure - Solution Guide

**Date:** November 14, 2025  
**Error:** `Invalid login: 535 Authentication Failed`  
**Status:** 🔧 REQUIRES EMAIL ADDRESS VERIFICATION

---

## 🚨 Problem Summary

Support ticket email submission fails with:
```
Error: Invalid login: 535 Authentication Failed
```

This indicates the Zoho SMTP credentials in Supabase are incorrect, expired, or using the wrong email address.

---

## 🔍 Critical Question: Which Email Address?

The application code references multiple email addresses. **We need to confirm which one is actually configured in Zoho:**

### Email Addresses Found in Code:

1. **`info@jgpaintingprosinc.com`** ← Most likely (with "inc")
   - Domain: `jgpaintingprosinc.com`
   - Professional sender address
   
2. **`no-reply@jgpaintingprosinc.com`** ← Alternative
   - Same domain with "inc"
   - Used as default from address

3. **`admin@jgpaintingpros.com`** ← Note different domain
   - Domain: `jgpaintingpros.com` (WITHOUT "inc")
   - Used only as reply-to

**The authentication failure suggests the ZOHO_EMAIL secret may be set to the wrong address.**

---

## ✅ Recommended Solution

### Step 1: Verify Zoho Account Email

**Please confirm:**
- What email address is actually set up in Zoho Mail?
- Is it `info@jgpaintingprosinc.com` or `info@jgpaintingpros.com`?
- Can you login to https://mail.zoho.com with this address?

### Step 2: Generate Fresh App-Specific Password

1. Login to Zoho Mail (https://mail.zoho.com)
2. Go to **Settings → Security → App Passwords**
3. Click **Generate New Password**
4. Select **"Other" or "Email Client/SMTP"**
5. Name it: "JG Painting Portal SMTP"
6. **Copy the generated password** (you can't view it again!)

### Step 3: Update Supabase Secrets

```bash
# Use the ACTUAL email address from your Zoho account
npx supabase secrets set ZOHO_EMAIL="info@jgpaintingprosinc.com"

# Use the app-specific password you just generated
npx supabase secrets set ZOHO_PASSWORD="xxxx-xxxx-xxxx-xxxx"
```

### Step 4: Verify Update

```bash
npx supabase secrets list | grep ZOHO
```

### Step 5: Test Email Sending

```bash
curl -X POST "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqcHRscHBwZnV6aWVicXptZ3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgxNDE3MjAsImV4cCI6MjAzMzcxNzcyMH0.u5C-c_UQAEMFx84qlLjB7AkYm50F62L_MFsPJxsyTNI" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "design@thunderlightmedia.com",
    "subject": "Test - Authentication Fixed",
    "html": "<h1>Success!</h1><p>Email is working.</p>",
    "text": "Success! Email is working."
  }'
```

---

## 🔧 Alternative: Interactive Fix Script

If you prefer a guided process:

```bash
./fix-zoho-credentials.sh
```

The script will:
1. Ask for your Zoho email address
2. Ask for your app-specific password  
3. Update Supabase secrets
4. Test the email function
5. Confirm everything is working

---

## 🔐 Important Notes

### Email Address Must Be EXACT
- ✅ **Correct:** Full email like `info@jgpaintingprosinc.com`
- ❌ **Wrong:** Just username like `info`
- ❌ **Wrong:** Wrong domain like `info@jgpaintingpros.com`

### Password Must Be App-Specific
- ✅ **Correct:** App-specific password from Zoho (looks like `abcd-efgh-ijkl-mnop`)
- ❌ **Wrong:** Your regular Zoho login password

### SMTP Settings (Already Correct)
- Host: `smtp.zoho.com` ✅
- Port: `587` ✅
- Security: STARTTLS ✅

---

## 📋 Quick Checklist

Before updating credentials:

- [ ] Confirmed actual Zoho email address (login to mail.zoho.com)
- [ ] Verified domain: Is it `.com`, `.prosinc.com`, or something else?
- [ ] Generated NEW app-specific password in Zoho
- [ ] Copied app-specific password to clipboard
- [ ] Ready to update Supabase secrets

After updating:

- [ ] Secrets updated in Supabase
- [ ] Waited 30 seconds for propagation
- [ ] Tested email via curl command
- [ ] Submitted test support ticket
- [ ] Verified email received

---

## 💡 Most Likely Issue

**Hypothesis:** The `ZOHO_EMAIL` secret is probably set to `info@jgpaintingpros.com` (without "inc"), but the actual Zoho account is `info@jgpaintingprosinc.com` (with "inc") or vice versa.

**Fix:** Confirm the correct email domain and update the secret accordingly.

---

## 📞 Need to Switch Email Providers?

If Zoho issues persist, Gmail is a solid alternative:

```bash
npx supabase secrets set ZOHO_EMAIL="your-email@gmail.com"
npx supabase secrets set ZOHO_PASSWORD="gmail-app-password"
npx supabase secrets set ZOHO_SMTP_HOST="smtp.gmail.com"
npx supabase secrets set ZOHO_SMTP_PORT="587"
```

Note: The env vars are named "ZOHO" but work with any SMTP provider.

---

## 🎯 Next Action Required

**Please confirm:**
1. What is the actual Zoho email address? (the one you can login to Zoho Mail with)
2. Is it `info@jgpaintingprosinc.com` or something else?

Once confirmed, we'll update the credentials and test immediately.

---

**Status:** Awaiting email address confirmation  
**Blocking:** Support ticket submissions  
**ETA to Fix:** 5 minutes after credentials provided
