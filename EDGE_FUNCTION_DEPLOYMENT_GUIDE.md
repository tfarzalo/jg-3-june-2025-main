# Quick Deployment Guide - Email Attachments

## 🚀 Deploy Edge Function to Supabase

The Edge Function has been updated with image attachment support. Follow these steps to deploy:

### Prerequisites
```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Or using Homebrew on macOS
brew install supabase/tap/supabase

# Login to Supabase
supabase login
```

### Step 1: Link Your Project
```bash
cd "/Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main - September 2025"

# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF
```

To find your `PROJECT_REF`:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Look at the URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`

### Step 2: Deploy the Edge Function
```bash
# Deploy the send-email function
supabase functions deploy send-email

# The command will output:
# Deploying function: send-email
# Function deployed successfully!
# URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-email
```

### Step 3: Verify Deployment
```bash
# Test the deployed function
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-email

# Should return:
# {"success":true,"message":"Send-email function is working","timestamp":"..."}
```

### Step 4: Configure Environment Variables

Go to Supabase Dashboard → Project Settings → Edge Functions → Add Secret:

```bash
ZOHO_EMAIL=your-email@jgpaintingprosinc.com
ZOHO_PASSWORD=your-app-specific-password
ZOHO_SMTP_HOST=smtp.zoho.com
ZOHO_SMTP_PORT=587
```

**Important:** Use an app-specific password, not your regular password!

To generate Zoho app password:
1. Go to https://accounts.zoho.com
2. Navigate to Security → App Passwords
3. Generate a new app password for "Supabase Email Function"
4. Copy and paste into Supabase secrets

### Step 5: Test Email Sending

Test with a simple email first:
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "to": "your-test-email@example.com",
    "subject": "Test Email",
    "html": "<h1>Test</h1><p>This is a test email.</p>"
  }'
```

### Step 6: Test with Attachments

Test with a small base64 encoded image:
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "to": "your-test-email@example.com",
    "subject": "Test Email with Attachment",
    "html": "<h1>Test</h1><p>This email has an attachment.</p>",
    "attachments": [
      {
        "filename": "test.txt",
        "content": "VGVzdCBmaWxlIGNvbnRlbnQ=",
        "contentType": "text/plain",
        "encoding": "base64"
      }
    ]
  }'
```

---

## 🔍 Troubleshooting

### Issue: "Function not found"
**Solution:** Verify you're using the correct project ref and the function is deployed.

### Issue: "SMTP credentials not configured"
**Solution:** Add environment variables in Supabase Dashboard (Step 4).

### Issue: "Authentication failed"
**Solution:** 
- Verify email and password are correct
- Use app-specific password, not regular password
- Check Zoho Mail account is active

### Issue: "Connection timeout"
**Solution:**
- Check SMTP host and port are correct
- Verify firewall isn't blocking port 587
- Try port 465 with SSL instead

### Issue: "Attachment too large"
**Solution:**
- Reduce image size before sending
- Limit to 5 images maximum
- Consider image compression

---

## 📝 Verification Checklist

After deployment, verify:

- [ ] Edge Function deploys successfully
- [ ] GET request returns success message
- [ ] Environment variables are set
- [ ] Test email sends and arrives
- [ ] Test email with attachment sends and arrives
- [ ] Attachment opens correctly
- [ ] Multiple attachments work
- [ ] Error handling works (invalid email, etc.)
- [ ] Logs show in Supabase Dashboard

---

## 📊 Monitoring

### View Edge Function Logs

1. Go to Supabase Dashboard
2. Edge Functions → send-email → Logs
3. Filter by date/time
4. Look for errors or warnings

### Key Log Messages to Watch:

**Success:**
```
SMTP connection verified successfully
Processing X attachments...
Successfully processed X attachments
Email sent successfully: <message-id>
```

**Errors:**
```
Zoho Mail credentials not configured
Failed to download image: ...
Attachment is missing content or path
Error sending email: ...
```

---

## 🔄 Updating the Function

If you make changes to the Edge Function:

```bash
# Make your changes to supabase/functions/send-email/index.ts

# Deploy the updated function
supabase functions deploy send-email

# Verify deployment
curl https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-email
```

No need to restart or redeploy the entire project - Edge Functions update instantly!

---

## 🎯 Next Steps

1. Deploy the Edge Function using steps above
2. Test email sending with attachments from the UI
3. Monitor logs for any issues
4. Document any issues or improvements needed
5. Train JG team on using the feature

---

## 💡 Tips

- **Start Small:** Test with one image first, then multiple
- **Check Logs:** Always check Edge Function logs after testing
- **Monitor Size:** Keep total attachment size under 15MB
- **Test Clients:** Test in Gmail, Outlook, Yahoo Mail
- **Mobile Test:** Check email appearance on mobile devices

---

**Status:** Ready to deploy!  
**Estimated Deploy Time:** 10-15 minutes  
**Required Access:** Supabase project admin access
