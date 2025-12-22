# Email Credentials Update - Final Steps

**Date:** November 14, 2025  
**Email Confirmed:** `info@jgpaintingprosinc.com` ✅  
**Status:** 🔄 NEEDS PASSWORD UPDATE

---

## ✅ Step 1: Email Address - COMPLETE

The ZOHO_EMAIL has been updated to: **`info@jgpaintingprosinc.com`**

---

## 🔑 Step 2: Generate Fresh App-Specific Password

You need to generate a new app-specific password in Zoho Mail:

### Instructions:

1. **Login to Zoho Mail:**
   - Go to: https://mail.zoho.com
   - Login with: `info@jgpaintingprosinc.com`

2. **Navigate to Security Settings:**
   - Click your **profile picture** (top right)
   - Select **"My Account"**
   - Click **"Security"** tab

3. **Generate App Password:**
   - Find section: **"App Passwords"** or **"Application-Specific Passwords"**
   - Click **"Generate New Password"**
   - Application type: Select **"Other"** or **"Email Client"**
   - Application name: Enter **"JG Painting Portal SMTP"**
   - Click **"Generate"**

4. **Copy the Password:**
   - The password will be shown ONCE (looks like: `abcd-1234-efgh-5678`)
   - **COPY IT IMMEDIATELY** - you won't be able to see it again!

---

## 🔄 Step 3: Update Password in Supabase

Once you have the app-specific password, run:

```bash
npx supabase secrets set ZOHO_PASSWORD="paste-your-app-password-here"
```

Replace `paste-your-app-password-here` with the actual password from Zoho.

---

## 🧪 Step 4: Test Email Function

After updating the password, test to make sure it works:

### Test A: Health Check
```bash
curl -X GET "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqcHRscHBwZnV6aWVicXptZ3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgxNDE3MjAsImV4cCI6MjAzMzcxNzcyMH0.u5C-c_UQAEMFx84qlLjB7AkYm50F62L_MFsPJxsyTNI"
```

**Expected:** Should show `"ZOHO_EMAIL": "SET"` and `"ZOHO_PASSWORD": "SET"`

### Test B: Send Test Email
```bash
curl -X POST "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqcHRscHBwZnV6aWVicXptZ3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgxNDE3MjAsImV4cCI6MjAzMzcxNzcyMH0.u5C-c_UQAEMFx84qlLjB7AkYm50F62L_MFsPJxsyTNI" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "design@thunderlightmedia.com",
    "subject": "Test Email - Credentials Fixed",
    "html": "<h1>Success! ✅</h1><p>Email authentication is now working with info@jgpaintingprosinc.com</p>",
    "text": "Success! Email authentication is now working with info@jgpaintingprosinc.com"
  }'
```

**Expected:** Should return `{"success": true, "messageId": "..."}` and you should receive the email.

### Test C: Support Ticket
1. Open the application
2. Go to Support Tickets page
3. Submit a test ticket
4. Should see "Ticket Submitted!" (no error)
5. Check design@thunderlightmedia.com inbox

---

## 📋 Summary

- ✅ **Email Address:** Updated to `info@jgpaintingprosinc.com`
- ⏳ **Password:** Waiting for you to generate and update
- ⏳ **Testing:** After password update

---

## 🆘 Troubleshooting

### If Password Generation Doesn't Work:

**Issue:** Can't find "App Passwords" in Zoho settings  
**Solution:** Check under:
- Settings → Security → Two-Factor Authentication
- Settings → Security → Application Passwords
- My Account → Security → App-Specific Passwords

### If Zoho Shows "SMTP Not Enabled":

**Issue:** SMTP/POP access disabled  
**Solution:**
1. Go to Settings → Mail Accounts → POP/IMAP Access
2. Enable SMTP access
3. Save changes
4. Try generating app password again

### If Still Getting 535 Error:

**Possible causes:**
1. Password not updated yet (do Step 3)
2. Typed password incorrectly (no spaces, exact copy)
3. Need to wait 30-60 seconds for secrets to propagate
4. Zoho account may have security hold (check Zoho email for alerts)

---

## 🎯 Next Action

**Please:**
1. Login to Zoho Mail (https://mail.zoho.com) with `info@jgpaintingprosinc.com`
2. Generate a new app-specific password
3. Run: `npx supabase secrets set ZOHO_PASSWORD="your-password-here"`
4. Test with the curl commands above
5. Confirm email arrives at design@thunderlightmedia.com

---

**Status:** Email address updated ✅ | Password pending ⏳  
**ETA:** 2-3 minutes to complete
