# 🧪 Daily Agenda Email - Quick Test Guide

## ✅ CORS Issue Fixed - Function Deployed

The Edge Function has been redeployed with proper CORS headers and is using the same `supabase.functions.invoke()` pattern as all other email features in your app.

---

## 🚀 Test Right Now

### Step 1: Refresh Your Browser
Press **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows) to hard refresh

### Step 2: Navigate to Settings
1. Click **Settings** in sidebar
2. Click **"Daily Agenda Emails"** button (purple button in Admin Settings section)

### Step 3: Send Test Email
1. Select radio button: **"Send to single test email"**
2. Enter your email address
3. Click **"Send Test Email Now"**

### Step 4: Watch For Success
You should see:
- ✅ Green success alert box
- ✅ Toast notification: "Test email sent successfully"
- ✅ Message: "Successfully sent 1 email(s)"

### Step 5: Check Your Email
- Check inbox (and spam folder)
- Email should show:
  - Subject: "JG Job Summary - [Today's Date]"
  - Job counts (Paint, Callback, Repair, Total)
  - Job cards with details

---

## 🐛 If It Doesn't Work

### Check Browser Console (F12)
**Look for:**
- ❌ Any CORS errors?
- ❌ Any red error messages?
- ✅ Should see logs from DailyAgendaEmailSettings.tsx

### Check Edge Function Logs
```bash
supabase functions logs send-daily-agenda-email --project-ref tbwtfimnbmvbgesidbxh
```

**Should see:**
```
=== SEND-DAILY-AGENDA-EMAIL FUNCTION CALLED ===
Request method: POST
Processing date: 2025-11-23
Sending to single recipient: your@email.com
```

### Verify Send-Email Function Works
```bash
supabase functions logs send-email --project-ref tbwtfimnbmvbgesidbxh
```

---

## 📊 What Changed

### Before (Had CORS Error):
```
❌ Access to fetch ... has been blocked by CORS policy
```

### After (Should Work Now):
```typescript
// Edge Function has proper CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "...",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// OPTIONS handler
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}
```

---

## ✅ Checklist

- [ ] Hard refreshed browser (Cmd+Shift+R / Ctrl+Shift+R)
- [ ] Can see "Daily Agenda Emails" button in Settings
- [ ] Button expands settings panel
- [ ] Can enter test email address
- [ ] "Send Test Email Now" button clicks
- [ ] No CORS error in console
- [ ] Success message appears
- [ ] Email received

---

## 📧 Email Should Look Like This

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Friday, November 23, 2025
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────┐
│   3 Paint  │  1 Callback  │  0 Repair │
│            4 Total                │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ WO-000544      [Job Request]   │
│ Affinity at Hudson              │
│ Property: Affinity at Hudson    │
│ Unit #345                       │
│ Assigned To: Timmy Testerton    │
│ Type: Paint                     │
└─────────────────────────────────┘

[More job cards...]
```

---

## 🎯 Success Criteria

✅ No CORS errors in console
✅ Green success alert appears
✅ Toast notification shows
✅ Email arrives in inbox
✅ Email formatting looks correct
✅ Job counts are accurate
✅ Job details are complete

---

## 🆘 Still Having Issues?

### 1. Verify Deployment
```bash
supabase functions list --project-ref tbwtfimnbmvbgesidbxh
```

Should show:
```
send-daily-agenda-email (deployed)
```

### 2. Test Send-Email Function
Open a new component that uses send-email (like Support Tickets) and verify email works there.

### 3. Check Environment Variables
In Supabase Dashboard → Settings → Edge Functions:
- ZOHO_EMAIL (set)
- ZOHO_PASSWORD (set)

### 4. Review Logs Together
Share the output of:
```bash
supabase functions logs send-daily-agenda-email --tail
```

---

**Status:** ✅ Fixed and Deployed
**Action:** Hard refresh browser and test now!
**Date:** November 23, 2025
