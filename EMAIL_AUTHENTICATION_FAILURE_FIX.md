# Email Authentication Failure - Fix Guide

**Date:** November 14, 2025  
**Issue:** SMTP Authentication Failed (Error 535)  
**Status:** 🔴 REQUIRES IMMEDIATE ACTION

---

## 🚨 Problem

Support ticket submission failed with:
```
Error: Invalid login: 535 Authentication Failed
```

This means the Zoho Mail credentials stored in Supabase are either:
1. ❌ Incorrect
2. ❌ Expired
3. ❌ Not an app-specific password
4. ❌ Account has 2FA enabled but using regular password

---

## 🔧 Solution: Update Zoho Credentials

### Step 1: Generate App-Specific Password in Zoho

**IMPORTANT:** Zoho requires an **App-Specific Password** for SMTP authentication, not your regular login password.

1. **Log into Zoho Mail:**
   - Go to https://mail.zoho.com
   - Sign in with your Zoho account

2. **Navigate to Security Settings:**
   - Click your profile picture (top right)
   - Select **"My Account"** or **"Account Settings"**
   - Go to **"Security"** section

3. **Generate App Password:**
   - Look for **"App Passwords"** or **"Application-Specific Passwords"**
   - Click **"Generate New Password"**
   - Name it: `JG Painting Pros Portal SMTP`
   - Copy the generated password (it will look like: `abcd1234efgh5678`)
   - **SAVE THIS PASSWORD** - you won't be able to see it again!

### Step 2: Update Supabase Secrets

Run these commands to update the credentials in Supabase:

```bash
# Update Zoho email address (if needed)
npx supabase secrets set ZOHO_EMAIL="your-zoho-email@zohomail.com"

# Update Zoho password with the NEW app-specific password
npx supabase secrets set ZOHO_PASSWORD="your-app-specific-password-here"

# Verify SMTP settings (usually these are correct)
npx supabase secrets set ZOHO_SMTP_HOST="smtp.zoho.com"
npx supabase secrets set ZOHO_SMTP_PORT="587"
```

### Step 3: Restart Edge Function

After updating secrets, restart the send-email function:

```bash
# The function will automatically use the new credentials
# You can verify by calling the health check endpoint
curl -X GET "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email" \
  -H "apikey: YOUR_ANON_KEY"
```

---

## 📋 Quick Fix Commands

### All-in-One Update Script

```bash
#!/bin/bash
# Update Zoho credentials in Supabase

echo "🔧 Updating Zoho Email Credentials"
echo ""
echo "Enter your Zoho email address:"
read ZOHO_EMAIL

echo "Enter your Zoho App-Specific Password:"
read -s ZOHO_PASSWORD

# Update secrets
npx supabase secrets set ZOHO_EMAIL="$ZOHO_EMAIL"
npx supabase secrets set ZOHO_PASSWORD="$ZOHO_PASSWORD"
npx supabase secrets set ZOHO_SMTP_HOST="smtp.zoho.com"
npx supabase secrets set ZOHO_SMTP_PORT="587"

echo ""
echo "✅ Credentials updated!"
echo ""
echo "Testing email function..."
curl -X GET "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqcHRscHBwZnV6aWVicXptZ3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgxNDE3MjAsImV4cCI6MjAzMzcxNzcyMH0.u5C-c_UQAEMFx84qlLjB7AkYm50F62L_MFsPJxsyTNI"
```

---

## 🔍 Common Issues & Solutions

### Issue 1: Regular Password Instead of App Password
**Problem:** Using your regular Zoho login password  
**Solution:** Generate and use an App-Specific Password (see Step 1 above)

### Issue 2: Two-Factor Authentication (2FA)
**Problem:** 2FA is enabled on your Zoho account  
**Solution:** You MUST use an App-Specific Password when 2FA is enabled

### Issue 3: Incorrect Email Format
**Problem:** Email address format is wrong  
**Solution:** Use the full Zoho email address (e.g., `name@zohomail.com`)

### Issue 4: SMTP Settings Wrong
**Problem:** Wrong SMTP host or port  
**Solution:** Use these exact values:
- Host: `smtp.zoho.com`
- Port: `587` (TLS/STARTTLS)
- Port: `465` (SSL) - alternative

### Issue 5: Password Expired
**Problem:** App-specific password was revoked or expired  
**Solution:** Generate a new app-specific password

### Issue 6: Account Suspended/Locked
**Problem:** Zoho account is suspended or locked  
**Solution:** Contact Zoho support or check account status

---

## 🧪 Testing After Fix

### Test 1: Health Check
```bash
curl -X GET "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqcHRscHBwZnV6aWVicXptZ3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgxNDE3MjAsImV4cCI6MjAzMzcxNzcyMH0.u5C-c_UQAEMFx84qlLjB7AkYm50F62L_MFsPJxsyTNI"
```

**Expected Response:**
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

### Test 2: Send Test Email
```bash
curl -X POST "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqcHRscHBwZnV6aWVicXptZ3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgxNDE3MjAsImV4cCI6MjAzMzcxNzcyMH0.u5C-c_UQAEMFx84qlLjB7AkYm50F62L_MFsPJxsyTNI" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "design@thunderlightmedia.com",
    "subject": "Test Email - Credential Fix",
    "html": "<h1>Test Email</h1><p>If you receive this, the credentials are working!</p>",
    "text": "Test Email - If you receive this, the credentials are working!"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "messageId": "some-message-id"
}
```

### Test 3: Submit Support Ticket
1. Go to Support page in the application
2. Fill out a test ticket
3. Submit
4. Should see "Ticket Submitted!" success message
5. Check design@thunderlightmedia.com for the email

---

## 📖 Zoho App Password Setup Guide

### Detailed Steps with Screenshots Context

1. **Access Zoho Mail Settings:**
   ```
   https://mail.zoho.com
   → Profile Icon (top right)
   → My Account
   → Security tab
   ```

2. **Find App Passwords Section:**
   - Look for "App Passwords" or "Application-Specific Passwords"
   - May be under "Security" or "Two-Factor Authentication"

3. **Generate New Password:**
   - Click "Generate New Password" button
   - Enter application name: `JG Painting Pros SMTP`
   - Click "Generate"

4. **Copy Password:**
   - Password will be shown ONCE
   - Format: usually 16 characters (letters and numbers)
   - Example: `abcd1234efgh5678`
   - Copy and save immediately

5. **Use in Supabase:**
   - This is your `ZOHO_PASSWORD` value
   - Never use your regular login password

---

## 🔐 Alternative Email Providers (If Zoho Continues to Fail)

If Zoho continues to have issues, consider these alternatives:

### Option 1: Gmail SMTP
```bash
npx supabase secrets set ZOHO_EMAIL="your-email@gmail.com"
npx supabase secrets set ZOHO_PASSWORD="app-specific-password"
npx supabase secrets set ZOHO_SMTP_HOST="smtp.gmail.com"
npx supabase secrets set ZOHO_SMTP_PORT="587"
```

### Option 2: SendGrid (Requires code changes)
- More reliable for high-volume
- Requires API key instead of SMTP
- Would need to modify send-email function

### Option 3: Resend (Already partially implemented)
- Modern email API
- Need to deploy send-notification-email function
- Set RESEND_API_KEY in Supabase

---

## 📝 Checklist

- [ ] Generate App-Specific Password in Zoho
- [ ] Update ZOHO_EMAIL in Supabase secrets
- [ ] Update ZOHO_PASSWORD in Supabase secrets (with app password)
- [ ] Verify ZOHO_SMTP_HOST is "smtp.zoho.com"
- [ ] Verify ZOHO_SMTP_PORT is "587"
- [ ] Test with health check endpoint
- [ ] Test with actual email send
- [ ] Submit test support ticket
- [ ] Verify email received at design@thunderlightmedia.com

---

## 🆘 If Still Not Working

### Check 1: Verify Secrets are Set
```bash
npx supabase secrets list
```
Should show all four Zoho secrets with hash values.

### Check 2: Check Zoho Account Status
- Log into Zoho Mail web interface
- Verify account is active
- Check for any security alerts

### Check 3: Check Edge Function Logs
```bash
npx supabase functions logs send-email --limit 20
```
Look for specific error messages.

### Check 4: Try Different SMTP Port
Update to use SSL instead of TLS:
```bash
npx supabase secrets set ZOHO_SMTP_PORT="465"
```

### Check 5: Contact Zoho Support
If app password still fails:
- Contact Zoho Mail support
- Verify SMTP is enabled for your account
- Check if there are any IP restrictions

---

## 💡 Quick Reference

### Correct Zoho SMTP Settings
```
Host: smtp.zoho.com
Port: 587 (STARTTLS/TLS)
Port: 465 (SSL) - alternative
Security: TLS/STARTTLS
Auth: YES (required)
Username: your-full-email@zohomail.com
Password: App-Specific Password (NOT regular password)
```

### Update Command Template
```bash
npx supabase secrets set ZOHO_EMAIL="your-email@domain.com"
npx supabase secrets set ZOHO_PASSWORD="your-16-char-app-password"
```

---

**Priority:** 🔴 HIGH - Email functionality is currently broken  
**Impact:** Support tickets cannot be submitted  
**Time to Fix:** 5-10 minutes (after generating app password)  
**Difficulty:** Easy (just credential update)

---

**Created:** November 14, 2025  
**Status:** Awaiting credential update
