# Daily Agenda Email Test - Troubleshooting Fix

## ✅ What Was Fixed

Updated the `send-daily-agenda-email` Edge Function with:

1. **Better error handling** when fetching email recipients
2. **More detailed logging** to debug issues
3. **Clearer error messages** when no recipients are found
4. **Inner join** on profiles to ensure valid email addresses

## 🔍 Most Likely Issues

### Issue 1: No Enabled Recipients (Most Common)

**Symptom**: "Edge Function returned a non-2xx status code"

**Cause**: No users have daily email enabled in the settings table

**Fix**: 
1. Go to Admin → Daily Agenda Email Settings
2. **Enable at least one user** by toggling the switch
3. Try sending test email again

### Issue 2: Missing Email Addresses

**Cause**: User profiles don't have email addresses

**Fix**:
Check that enabled users have valid email addresses in their profiles:
```sql
SELECT p.full_name, p.email, des.enabled
FROM profiles p
LEFT JOIN daily_email_settings des ON des.user_id = p.id
WHERE p.role IN ('admin', 'manager');
```

### Issue 3: send-email Function Error

**Cause**: The underlying `send-email` function failed (Zoho authentication, etc.)

**Check**: Supabase Dashboard → Edge Functions → `send-email` → Logs

## 📊 How to Debug (New and Improved!)

### Step 1: Check Edge Function Logs

1. Go to Supabase Dashboard → Edge Functions
2. Click `send-daily-agenda-email`
3. Click "Logs" tab
4. Look for the most recent error

**New helpful log messages you'll see:**
- `"Found X enabled recipients"` - Shows how many people will receive email
- `"✓ Email sent successfully to user@example.com"` - Success per recipient
- `"✗ Failed to send email to user@example.com: [error]"` - Failure details
- `"No enabled recipients found. Please enable at least one user..."` - Clear error message

### Step 2: Verify Settings

Run this SQL in Supabase SQL Editor:
```sql
-- Check who is enabled for daily emails
SELECT 
  p.full_name,
  p.email,
  p.role,
  des.enabled,
  des.updated_at
FROM daily_email_settings des
JOIN profiles p ON p.id = des.user_id
WHERE des.enabled = true;
```

**Expected**: At least one row with `enabled = true` and a valid email

### Step 3: Test Again

1. Go to Admin → Daily Agenda Email Settings
2. Ensure at least one user is enabled (toggle switch ON)
3. Click "Send Test Email" again
4. Check the logs for detailed error messages

## 🚀 Quick Fix Steps

If you're still getting the error:

1. **Enable a user**:
   - Go to Admin → Daily Agenda Email Settings
   - Toggle ON at least one admin/manager user
   - Verify the toggle stays ON after page refresh

2. **Verify the user has an email**:
   ```sql
   SELECT * FROM profiles WHERE role IN ('admin', 'manager') AND email IS NOT NULL;
   ```

3. **Try single recipient test first**:
   - In the test email section, select "Single Recipient"
   - Enter your own email
   - Click "Send Test Email Now"
   - This bypasses the settings table

4. **Check for recent function logs**:
   - Logs will now show exactly which step failed
   - Much easier to diagnose!

## 🐛 Still Having Issues?

Check the Edge Function logs and look for these new detailed messages:

- `"No enabled recipients found"` → Enable at least one user in settings
- `"Failed to fetch email settings: [error]"` → Database permissions issue
- `"Error sending email: [error]"` → Issue with send-email function (Zoho)
- `"Send-email function error: [details]"` → Specific email sending problem

---

## ✅ Changes Deployed

The updated function with better error handling has been deployed to Supabase.

**Next Steps**:
1. Try sending a test email again
2. Check the logs for detailed error information
3. Share the specific error message if you still have issues

---

*Last Updated: November 24, 2024*
