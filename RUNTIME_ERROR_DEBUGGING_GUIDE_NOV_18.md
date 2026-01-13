# 🔧 Runtime Error Debugging Guide - November 18, 2024

## 🎯 Purpose
This guide provides step-by-step instructions to capture and diagnose actual runtime errors for:
1. **Email Sending** (via send-email edge function)
2. **User Creation** (via create-user edge function)

## 📊 What We've Enhanced

### Enhanced Error Logging - EnhancedPropertyNotificationModal.tsx
```typescript
// Now includes detailed logging for:
- Email payload structure
- Function invocation details
- Response data and errors
- Success/failure states
- Full error stack traces
```

### Enhanced Error Logging - Users.tsx
```typescript
// Now includes detailed logging for:
- User creation payload
- Function URL and headers
- Response status and body
- Success/failure states
- Full error stack traces
```

### Enhanced Error Logging - Edge Functions
Both `send-email` and `create-user` functions now have:
- Detailed console logging at every step
- Environment variable validation
- Error stack trace capture
- Response formatting with full context

## 🚀 Testing Instructions

### Step 1: Test Email Sending

1. **Open the application in your browser**
   - Navigate to a job details page
   - Click on "Send Notification" or "Request Approval"

2. **Open Browser Developer Console**
   - Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows/Linux)
   - Go to the "Console" tab

3. **Try to send an email**
   - Select a template
   - Enter recipient email
   - Click "Send"

4. **Capture the console output**
   - Look for sections starting with `===`
   - Copy ALL output between:
     - `=== INVOKING SEND-EMAIL FUNCTION ===`
     - `=== SEND-EMAIL FUNCTION RESPONSE ===`
     - Any `❌` error messages

5. **Check Supabase Edge Function Logs**
   - Go to Supabase Dashboard
   - Navigate to: Edge Functions → send-email → Logs
   - Look for recent invocations
   - Capture any error messages or stack traces

### Step 2: Test User Creation

1. **Navigate to Users page**
   - Click on "Users" in the sidebar

2. **Open Browser Developer Console** (if not already open)

3. **Click "Add User" button**
   - Fill in the form with test data
   - Email: `test@example.com`
   - Password: `TestPass123!`
   - Full Name: `Test User`
   - Role: Select any role

4. **Click "Create User"**

5. **Capture the console output**
   - Look for sections starting with `===`
   - Copy ALL output between:
     - `=== CREATING USER VIA EDGE FUNCTION ===`
     - `=== CREATE-USER FUNCTION RESPONSE ===`
     - Any `❌` error messages

6. **Check Supabase Edge Function Logs**
   - Go to Supabase Dashboard
   - Navigate to: Edge Functions → create-user → Logs
   - Look for recent invocations
   - Capture any error messages or stack traces

## 🔍 What to Look For

### Email Sending Errors

#### Common Issues:
1. **Environment Variables Not Set**
   ```
   Error: Zoho Mail credentials not configured
   ```
   **Solution:** Set `ZOHO_EMAIL` and `ZOHO_PASSWORD` in Supabase Edge Function secrets

2. **SMTP Connection Failed**
   ```
   Error: connect ETIMEDOUT
   Error: EAUTH - authentication failed
   ```
   **Solution:** Verify SMTP credentials, check if Zoho allows "app passwords"

3. **Attachment Processing Failed**
   ```
   Error: Failed to download [filename]
   Error: No file data returned
   ```
   **Solution:** Check storage bucket permissions, verify file paths

4. **Invalid Email Format**
   ```
   Error: Invalid recipient email
   ```
   **Solution:** Validate email addresses in the UI

### User Creation Errors

#### Common Issues:
1. **Missing Service Role Key**
   ```
   Error: Missing environment variables
   ```
   **Solution:** Set `SUPABASE_SERVICE_ROLE_KEY` in edge function secrets

2. **Authentication Failed**
   ```
   Error: Authentication failed: No user found
   ```
   **Solution:** Ensure user is logged in before attempting to create users

3. **Permission Denied**
   ```
   Error: User not allowed (403)
   ```
   **Solution:** Check current user's role - only admins can create users

4. **Profile Creation Failed**
   ```
   Error: Profile creation failed
   ```
   **Solution:** Check RLS policies on `profiles` table

## 🛠 Environment Variable Checklist

### Required Variables for send-email function:
- [ ] `ZOHO_EMAIL` - Your Zoho email address
- [ ] `ZOHO_PASSWORD` - Your Zoho email password or app-specific password
- [ ] `ZOHO_SMTP_HOST` (optional, defaults to `smtp.zoho.com`)
- [ ] `ZOHO_SMTP_PORT` (optional, defaults to `587`)

### Required Variables for create-user function:
- [ ] `SUPABASE_URL` - Your Supabase project URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (admin key)

### How to Set Environment Variables in Supabase:

1. Go to Supabase Dashboard
2. Navigate to: Project Settings → Edge Functions
3. Scroll to "Secrets"
4. Add each variable:
   - Key: `ZOHO_EMAIL`
   - Value: `your-email@domain.com`
5. Click "Add Secret"
6. Repeat for all required variables

**⚠️ IMPORTANT:** After adding or updating secrets, you must redeploy the edge functions:
```bash
cd supabase/functions
supabase functions deploy send-email
supabase functions deploy create-user
```

## 🧪 Quick Test Commands

### Test send-email function directly:
```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/send-email' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "text": "This is a test email",
    "html": "<p>This is a test email</p>"
  }'
```

### Check if edge function is running:
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
    "ZOHO_EMAIL": "SET",
    "ZOHO_PASSWORD": "SET"
  }
}
```

## 📝 Next Steps After Capturing Errors

1. **Review the captured console output**
   - Identify the exact error message
   - Check the error type (authentication, network, validation, etc.)

2. **Check environment variables**
   - Verify all required secrets are set
   - Confirm they contain valid values

3. **Verify database permissions**
   - Check RLS policies on relevant tables
   - Ensure service role key has proper permissions

4. **Test SMTP connectivity**
   - Verify Zoho credentials work outside the app
   - Check if IP is whitelisted (if applicable)

5. **Check storage bucket permissions**
   - Verify `job-images` bucket exists
   - Check read permissions for authenticated users

6. **Review code changes**
   - Ensure all recent refactors are deployed
   - Check for any TypeScript compilation errors

## 🆘 Common Solutions

### If email sending fails with authentication error:
1. Check if you're using a Zoho "app password" instead of regular password
2. Enable "Less secure app access" in Zoho (if required)
3. Verify the email address matches the Zoho account

### If user creation fails with "approvals table" error:
1. Run the migration: `fix_approvals_table_nov_18_2024.sql`
2. Verify the migration completed successfully
3. Check that all references to `approvals` table are removed

### If images fail to attach:
1. Check browser console for download errors
2. Verify storage bucket permissions
3. Ensure file paths are correct in the database
4. Check file sizes (may be too large for email)

## 📊 Success Indicators

### Email Sending Success:
```
✅ Email sent successfully: [messageId]
```

### User Creation Success:
```
✅ User created successfully: [userId]
```

## 📞 Support

If errors persist after following this guide:
1. Capture all console output as described above
2. Capture Supabase edge function logs
3. Document the exact steps to reproduce
4. Share all captured information for further analysis
