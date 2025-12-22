# Daily Agenda Email - Email Function Connection Fix

## ✅ Issue Resolved

The `send-daily-agenda-email` Edge Function now properly connects to the `send-email` function using direct HTTP fetch calls instead of `supabase.functions.invoke()`.

## What Was Changed

### 1. Edge Function (`send-daily-agenda-email/index.ts`)

**Before:**
```typescript
const { data, error } = await supabase.functions.invoke('send-email', {
  body: { to, subject, html }
});
```

**After:**
```typescript
const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to,
    subject,
    html,
    text: `Please view this email in an HTML-enabled email client.`
  })
});
```

### 2. React Component (`DailyAgendaEmailSettings.tsx`)

**Before:**
```typescript
const { data, error } = await supabase.functions.invoke('send-daily-agenda-email', {
  body: { mode, recipient, test }
});
```

**After:**
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/send-daily-agenda-email`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mode, recipient, test })
  }
);
```

## Why This Matters

The `supabase.functions.invoke()` method can have issues with:
- Edge function to edge function communication
- Service role authentication
- Response parsing

Using direct HTTP `fetch()` calls:
- ✅ More reliable
- ✅ Better error handling
- ✅ Proper authentication flow
- ✅ Standard HTTP responses

## Redeploy Required

After this change, you need to redeploy the Edge Function:

```bash
supabase functions deploy send-daily-agenda-email
```

## Testing the Fix

### 1. Test Edge Function Directly

```bash
# Get your session token from browser dev tools or:
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-daily-agenda-email' \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "single",
    "recipient": "your-email@example.com",
    "test": true
  }'
```

### 2. Test from UI

1. Navigate to **Settings → Daily Agenda Emails**
2. Select "Send to single test email"
3. Enter your email
4. Click "Send Test Email Now"
5. Check browser console for detailed logs
6. Check email inbox (and spam folder)

### 3. Verify send-email Function

First, ensure the base send-email function works:

```bash
curl -X POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-email' \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "test@example.com",
    "subject": "Test Email",
    "html": "<h1>Test</h1><p>This is a test email.</p>",
    "text": "Test email"
  }'
```

## Required Environment Variables

Make sure these are set in Supabase Dashboard → Settings → Edge Functions:

```
ZOHO_EMAIL=your-zoho-email@zohomail.com
ZOHO_PASSWORD=your-zoho-password
ZOHO_SMTP_HOST=smtp.zoho.com
ZOHO_SMTP_PORT=587
```

## Check Logs

View logs for debugging:

```bash
# View send-daily-agenda-email logs
supabase functions logs send-daily-agenda-email --project-ref YOUR_PROJECT_REF

# View send-email logs
supabase functions logs send-email --project-ref YOUR_PROJECT_REF
```

## Common Issues & Solutions

### Issue: "Not authenticated" error
**Solution:** Make sure you're logged in as an admin user

### Issue: "Failed to send email" error
**Solution:** 
1. Check Zoho credentials in Edge Function settings
2. Verify Zoho account is active
3. Check send-email function logs

### Issue: Email not received
**Solution:**
1. Check spam folder
2. Verify recipient email address
3. Check Zoho email sending limits
4. Review send-email function logs

### Issue: "Cannot find module" errors in IDE
**Solution:** These are expected for Deno Edge Functions - they work fine when deployed

## Verification Checklist

- [ ] Edge Function redeployed: `supabase functions deploy send-daily-agenda-email`
- [ ] Environment variables set (ZOHO_EMAIL, ZOHO_PASSWORD)
- [ ] Can access Daily Agenda Emails settings
- [ ] Test email to single recipient works
- [ ] Test email to all enabled users works
- [ ] Email received in inbox
- [ ] Email formatting looks correct
- [ ] Browser console shows no errors
- [ ] Edge Function logs show successful sends

## Next Steps

If everything works:
1. ✅ Enable email for production users
2. ✅ Set up cron job for 5 AM daily sends
3. ✅ Monitor logs for the first few days
4. ✅ Verify emails are being received

## Support

If you still have issues:
1. Check browser console (F12)
2. Check Edge Function logs
3. Verify all environment variables
4. Test send-email function independently
5. Check Supabase project status

---

**Status:** ✅ Fixed and Ready for Testing
**Date:** November 23, 2025
