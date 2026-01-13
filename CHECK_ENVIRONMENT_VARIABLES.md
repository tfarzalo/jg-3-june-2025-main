# 🔐 Environment Variables Configuration Guide

## Overview
This guide helps you verify and configure all required environment variables for the JG Painting Pros application.

## 📋 Required Environment Variables

### Frontend Application (.env or environment)

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Supabase Edge Functions

#### For `send-email` function:
```bash
ZOHO_EMAIL=your-email@jgpaintingprosinc.com
ZOHO_PASSWORD=your_zoho_password_or_app_password
ZOHO_SMTP_HOST=smtp.zoho.com  # Optional, defaults to smtp.zoho.com
ZOHO_SMTP_PORT=587            # Optional, defaults to 587
```

#### For `create-user` function:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

#### For `send-approval-reminder` function (if applicable):
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
ZOHO_EMAIL=your-email@jgpaintingprosinc.com
ZOHO_PASSWORD=your_zoho_password_or_app_password
```

## 🔍 How to Check Current Configuration

### Method 1: Using Supabase Dashboard

1. Log in to Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to: **Project Settings** → **Edge Functions**
4. Scroll down to the **"Secrets"** section
5. Review the list of configured secrets

### Method 2: Test Endpoint

Run this command to test if send-email function has proper configuration:

```bash
curl -X GET 'https://your-project.supabase.co/functions/v1/send-email'
```

Expected response:
```json
{
  "success": true,
  "message": "Send-email function is working",
  "timestamp": "2024-11-18T...",
  "env_check": {
    "ZOHO_EMAIL": "SET",        ← Should show "SET"
    "ZOHO_PASSWORD": "SET"       ← Should show "SET"
  }
}
```

If you see `"NOT SET"`, you need to configure that variable.

## 📝 How to Set Environment Variables

### For Supabase Edge Functions:

1. **Via Supabase Dashboard:**
   - Go to: Project Settings → Edge Functions → Secrets
   - Click "New Secret"
   - Enter the secret name (e.g., `ZOHO_EMAIL`)
   - Enter the secret value
   - Click "Add Secret"
   - **Important:** Redeploy affected functions after adding secrets

2. **Via Supabase CLI:**
   ```bash
   # Set a secret
   supabase secrets set ZOHO_EMAIL=your-email@example.com
   
   # Set multiple secrets from a file
   supabase secrets set --env-file ./supabase/.env
   
   # View all secrets (values are masked)
   supabase secrets list
   ```

3. **Redeploy Functions:**
   After setting secrets, redeploy the functions:
   ```bash
   cd supabase/functions
   supabase functions deploy send-email
   supabase functions deploy create-user
   ```

### For Frontend Application:

1. Create or edit `.env` file in project root:
   ```bash
   # .env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

2. Restart the development server:
   ```bash
   npm run dev
   ```

## 🔒 Zoho Email Configuration

### Option 1: Use Regular Password (Less Secure)
1. Use your regular Zoho account password
2. Enable "Less Secure App Access" in Zoho settings (if required)

### Option 2: Use App-Specific Password (Recommended)
1. Log in to Zoho Mail
2. Go to: Settings → Security → App Passwords
3. Generate a new app password for "Mail App"
4. Use this app password as `ZOHO_PASSWORD` in your edge function secrets

### SMTP Settings for Zoho:
- **Host:** `smtp.zoho.com`
- **Port:** `587` (STARTTLS) or `465` (SSL)
- **Security:** TLS/SSL required
- **Authentication:** Username/Password

## 🔧 Troubleshooting

### Issue: "Missing environment variables" error

**Solution:**
1. Verify the secret exists in Supabase Dashboard
2. Check the secret name matches exactly (case-sensitive)
3. Redeploy the edge function after adding secrets
4. Wait a few minutes for deployment to complete

### Issue: "EAUTH - authentication failed" (Email)

**Solution:**
1. Verify Zoho email and password are correct
2. Check if using app-specific password (recommended)
3. Verify SMTP settings (host, port)
4. Check if IP address needs whitelisting in Zoho

### Issue: "ETIMEDOUT" (Email)

**Solution:**
1. Check SMTP port (try 587 or 465)
2. Verify firewall/network allows outbound SMTP connections
3. Test SMTP connection from another tool (e.g., telnet, netcat)

### Issue: Service role key not working

**Solution:**
1. Get the correct service role key from Supabase Dashboard:
   - Go to: Project Settings → API → Project API keys
   - Copy the `service_role` key (not the `anon` key)
2. Set it in edge function secrets as `SUPABASE_SERVICE_ROLE_KEY`
3. Redeploy the edge function

## ✅ Verification Checklist

Before testing email sending or user creation:

- [ ] Frontend `.env` file has correct `VITE_SUPABASE_URL`
- [ ] Frontend `.env` file has correct `VITE_SUPABASE_ANON_KEY`
- [ ] Edge function has `ZOHO_EMAIL` secret set
- [ ] Edge function has `ZOHO_PASSWORD` secret set
- [ ] Edge function has `SUPABASE_URL` secret set
- [ ] Edge function has `SUPABASE_SERVICE_ROLE_KEY` secret set
- [ ] All edge functions have been redeployed after setting secrets
- [ ] Test endpoint returns `"SET"` for all environment checks
- [ ] Zoho email credentials work (test via email client)
- [ ] Service role key is the correct admin key (not anon key)

## 🧪 Quick Test Script

Create a file `test-env.sh` and run it to verify your setup:

```bash
#!/bin/bash

# Replace with your actual values
PROJECT_URL="https://your-project.supabase.co"
ANON_KEY="your_anon_key_here"

echo "🔍 Testing send-email function environment..."
curl -X GET "${PROJECT_URL}/functions/v1/send-email" \
  -H "Authorization: Bearer ${ANON_KEY}" | jq

echo ""
echo "🔍 Testing create-user function (just checking if it responds)..."
curl -X OPTIONS "${PROJECT_URL}/functions/v1/create-user" \
  -H "Authorization: Bearer ${ANON_KEY}"
```

Make it executable and run:
```bash
chmod +x test-env.sh
./test-env.sh
```

## 📚 Additional Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Supabase Secrets Management](https://supabase.com/docs/guides/functions/secrets)
- [Zoho Mail SMTP Configuration](https://www.zoho.com/mail/help/zoho-smtp.html)
- [Nodemailer Documentation](https://nodemailer.com/about/)

## 🆘 Still Having Issues?

1. Run the test endpoint: `GET /functions/v1/send-email`
2. Capture the response showing which env vars are "NOT SET"
3. Check Supabase Dashboard → Edge Functions → Logs for detailed error messages
4. Verify all secrets are set correctly in the Dashboard
5. Ensure edge functions are redeployed after changing secrets
6. Test Zoho credentials independently (via email client or other SMTP tool)
