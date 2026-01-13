# How to Send a Test Email Right Now

## 🎯 Three Ways to Test the Daily Email

### Option 1: Use the Admin UI (Easiest! ✅)

1. Go to your app's admin section
2. Navigate to **Admin → Daily Agenda Email Settings**
3. Click the **"Send Test Email"** button
4. Check your inbox (or the configured recipient emails)

**This is the simplest method and tests the entire system end-to-end!**

---

### Option 2: Run SQL in Supabase (Tests pg_cron command)

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste from `test_send_email_now.sql`
3. Click "Run"
4. Check your inbox

This executes the exact same command that pg_cron runs at 5 AM.

```sql
SELECT 
  content::json->>'message' as result
FROM 
  http((
    'POST',
    'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email',
    ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true))
    ],
    'application/json',
    '{"action": "send_daily_email", "manual": false}'
  )::http_request);
```

---

### Option 3: Use curl Command (Tests Edge Function directly)

Run this in your terminal (replace with your actual keys):

```bash
curl -i --location --request POST \
  'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email' \
  --header 'Authorization: Bearer YOUR_ANON_KEY_HERE' \
  --header 'Content-Type: application/json' \
  --data '{"scheduled": true}'
```

To get your anon key:
1. Go to Supabase Dashboard
2. Settings → API
3. Copy "anon public" key

---

## 🔍 What Each Method Tests

| Method | Tests Admin UI | Tests pg_cron | Tests Edge Function | Tests Email Sending |
|--------|---------------|---------------|---------------------|---------------------|
| Option 1 (Admin UI) | ✅ | ❌ | ✅ | ✅ |
| Option 2 (SQL) | ❌ | ✅ | ✅ | ✅ |
| Option 3 (curl) | ❌ | ❌ | ✅ | ✅ |

**Recommendation**: Use **Option 1** (Admin UI button) first for the easiest test!

---

## ✅ What to Expect

After running any test method:

1. **Immediate response** (within a few seconds)
2. **Email sent** to all configured recipients
3. **Subject**: "Daily Job Summary for [Today's Date]"
4. **Content**: Table with all jobs scheduled for today

---

## 🐛 Troubleshooting

### No email received?

1. **Check spam/junk folder**
2. **Verify recipients in admin settings**:
   - Go to Admin → Daily Agenda Email Settings
   - Confirm email addresses are correct
   - Ensure "Enable daily email" is checked
3. **Check Edge Function logs**:
   - Supabase Dashboard → Edge Functions → send-daily-agenda-email → Logs
   - Look for errors or successful execution
4. **Verify there are jobs for today**:
   ```sql
   SELECT * FROM jobs 
   WHERE DATE(job_date) = CURRENT_DATE 
   AND status NOT IN ('cancelled', 'completed');
   ```

### Error in SQL execution?

Make sure the `app.settings.service_role_key` is configured in your Supabase project settings.

### curl returns 401 error?

Double-check your anon key is correct and active.

---

## 📝 After Testing

Once you've confirmed the test email works:

1. ✅ You know the Edge Function is working
2. ✅ You know email delivery is configured correctly
3. ✅ You can trust that the 5 AM automated send will work
4. ✅ No need to wait until Monday morning!

---

## 🚀 Next Steps

1. Send a test email using one of the methods above
2. Verify it arrives with correct content
3. Confirm job data is accurate
4. You're all set for automated daily emails!

---

*Pro Tip: The Admin UI test button is the easiest and most comprehensive test method!*
