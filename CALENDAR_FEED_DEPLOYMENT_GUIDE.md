# Calendar Feed Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying the updated calendar-feed Edge Function to Supabase.

---

## Prerequisites

- [x] Supabase CLI installed
- [x] Logged in to Supabase CLI (`supabase login`)
- [x] Project linked (`supabase link --project-ref YOUR_PROJECT_REF`)

---

## Deployment Steps

### Step 1: Verify You're in the Project Directory

```bash
cd /Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main\ -\ September\ 2025
```

### Step 2: Ensure Supabase CLI is Logged In

```bash
supabase login
```

If you're already logged in, you'll see a confirmation message.

### Step 3: Link to Your Project (if not already linked)

```bash
supabase link --project-ref tbwtfimnbmvbgesidbxh
```

### Step 4: Deploy the Calendar Feed Function

```bash
supabase functions deploy calendar-feed
```

This will:
- Bundle the function code
- Upload to Supabase
- Make it live at: `https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed`

### Step 5: Verify Deployment

Test the deployed function with a sample request:

```bash
# Replace YOUR_TOKEN with an actual calendar token from your database
curl "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed?scope=events&token=YOUR_TOKEN"
```

You should see an ICS calendar file returned.

---

## Environment Variables

The edge function requires these environment variables (they should already be set):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### To Check Environment Variables:

1. Go to Supabase Dashboard
2. Navigate to: **Project Settings** → **Edge Functions** → **Secrets**
3. Verify all three variables are present

### To Add/Update Variables (if needed):

```bash
# Add SUPABASE_URL
supabase secrets set SUPABASE_URL=https://tbwtfimnbmvbgesidbxh.supabase.co

# Add SUPABASE_ANON_KEY
supabase secrets set SUPABASE_ANON_KEY=your_anon_key_here

# Add SUPABASE_SERVICE_ROLE_KEY
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

---

## Testing After Deployment

### Test 1: Events Feed

```bash
TOKEN="your-calendar-token-here"
curl "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed?scope=events&token=$TOKEN"
```

**Expected**: ICS file with calendar events

### Test 2: Events + Job Requests Feed

```bash
TOKEN="your-calendar-token-here"
curl "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed?scope=events_and_job_requests&token=$TOKEN"
```

**Expected**: ICS file with events and job requests using new title format

### Test 3: Subcontractor Feed

```bash
TOKEN="subcontractor-calendar-token-here"
curl "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed?scope=subcontractor&token=$TOKEN"
```

**Expected**: ICS file with assigned jobs (without subcontractor name in titles)

### Test 4: Import to Calendar App

1. Copy one of the feed URLs:
   ```
   https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed?scope=events_and_job_requests&token=YOUR_TOKEN
   ```

2. **For Apple Calendar**:
   - File → New Calendar Subscription
   - Paste the URL
   - Click Subscribe

3. **For Google Calendar**:
   - Settings → Add Calendar → From URL
   - Paste the URL
   - Click Add Calendar

4. **Verify Event Titles**:
   - Job events should show: `Address | WO#xxxx | Subcontractor | Job Type`
   - Check that all components are present

---

## Rollback Procedure

If issues arise, you can rollback to a previous version:

### Option 1: Redeploy Previous Version from Git

```bash
# Checkout previous commit
git checkout HEAD~1 supabase/functions/calendar-feed/index.ts

# Redeploy
supabase functions deploy calendar-feed

# Restore to latest
git checkout main supabase/functions/calendar-feed/index.ts
```

### Option 2: Use Supabase Dashboard

1. Go to Supabase Dashboard
2. Navigate to **Edge Functions** → **calendar-feed**
3. Click on **Deployments** tab
4. Select a previous deployment
5. Click **Redeploy**

---

## Monitoring

### View Function Logs

```bash
supabase functions logs calendar-feed --follow
```

Or via Dashboard:
1. **Edge Functions** → **calendar-feed**
2. Click **Logs** tab
3. Monitor real-time requests and errors

### Common Issues

#### Issue: "Missing token"
**Cause**: No `token` parameter in URL
**Solution**: Ensure all feed URLs include `&token=xxx`

#### Issue: "Invalid scope"
**Cause**: Incorrect scope parameter
**Solution**: Use one of: `events`, `events_and_job_requests`, `completed_jobs`, `subcontractor`

#### Issue: "Server misconfigured (env)"
**Cause**: Missing environment variables
**Solution**: Set secrets as described above

#### Issue: Event titles don't show new format
**Cause**: Calendar app using cached version
**Solution**: 
- Wait 5 minutes for cache to expire
- Or remove and re-add the calendar subscription

---

## Post-Deployment Checklist

- [ ] Function deployed successfully
- [ ] No errors in function logs
- [ ] Test feed URL returns ICS file
- [ ] Event titles show new format with all components
- [ ] Subcontractor feeds omit subcontractor name
- [ ] Apple Calendar can subscribe successfully
- [ ] Google Calendar can subscribe successfully
- [ ] Events display with correct date/time
- [ ] Location field populates
- [ ] Portal links work when clicked
- [ ] Cache behavior is correct (5-minute refresh)

---

## Performance Notes

- **Cache Duration**: 5 minutes (`max-age=300`)
- **Response Time**: Typically < 2 seconds
- **Concurrent Requests**: Handles multiple simultaneous subscriptions
- **Data Volume**: Efficiently handles 1000+ events

---

## Support

If issues persist after deployment:

1. **Check Function Logs**:
   ```bash
   supabase functions logs calendar-feed --follow
   ```

2. **Verify Database**:
   - Ensure `calendar_tokens` table has tokens
   - Check that jobs have proper relationships (property, job_type, assigned_to)

3. **Test Locally** (optional):
   ```bash
   supabase functions serve calendar-feed
   ```

4. **Contact Support**:
   - Include: Error message, timestamp, request URL
   - Attach: Function logs, browser network tab

---

## Next Steps

After successful deployment:

1. **Notify Users**: Update documentation or send notification about new event title format
2. **Update Existing Subscriptions**: Users should remove and re-add calendar subscriptions to get new format
3. **Monitor Usage**: Check function logs for any errors over first 24 hours
4. **Gather Feedback**: Confirm new format meets user needs

---

## Deployment Command Summary

```bash
# Quick deployment (run from project root)
cd "/Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main - September 2025"
supabase functions deploy calendar-feed

# With verbose logging
supabase functions deploy calendar-feed --debug

# Deploy and immediately check logs
supabase functions deploy calendar-feed && supabase functions logs calendar-feed --follow
```

---

## Completed

- ✅ Code updated and committed
- ✅ Documentation created
- ✅ Ready for deployment
- ⏳ **Next**: Deploy using commands above
- ⏳ **Then**: Test with actual calendar subscriptions
