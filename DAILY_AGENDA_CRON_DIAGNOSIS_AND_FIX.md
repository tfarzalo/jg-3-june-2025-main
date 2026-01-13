# Daily Agenda Email Cron Job - Diagnosis and Fix

## 📊 Current Status (Dec 11, 2025)

### ✅ What's Working
- **Cron job is active and running**
  - Job ID: 2
  - Name: `daily-agenda-email-job`
  - Schedule: `0 14 * * *` (2:00 PM UTC = 9:00 AM EST)
  - Recent runs: Successfully executed on Dec 8, 9, 10, 11

### ⚠️ Issues Identified
1. **Dec 5 Failure**: JSON parsing error suggests Edge Function returned HTML instead of JSON
2. **Unknown Command**: Need to verify what SQL the cron job is actually executing
3. **Email Delivery**: Need to confirm if emails are actually being sent

## 🔍 Investigation Steps

### Step 1: Check Current Cron Command
Run `CHECK_CURRENT_CRON_COMMAND.sql` to see the exact SQL being executed.

**Expected Output:**
```sql
-- Should see the full command that the cron job runs
-- Could be one of:
-- A) SELECT check_and_send_daily_email() -- ❌ Won't work (doesn't call Edge Function)
-- B) SELECT http(...) -- ✅ Correct (calls Edge Function via HTTP)
```

### Step 2: Verify Edge Function Status
Run `CHECK_EDGE_FUNCTION_STATUS.sql` to confirm:
- HTTP extension is enabled
- Edge Function is deployed
- Configuration is correct

### Step 3: Check Email Recipients
Query who should be receiving emails:
```sql
SELECT 
  p.email,
  p.full_name,
  p.role,
  des.enabled
FROM daily_email_settings des
JOIN profiles p ON p.id = des.user_id
WHERE des.enabled = true;
```

## 🔧 Fix Options

### Option A: Cron Job is Missing HTTP Call
**If the current job is calling `check_and_send_daily_email()`:**

1. Run the migration: `FIX_DAILY_AGENDA_CRON_JOB.sql`
2. This will:
   - Remove old cron job
   - Enable HTTP extension
   - Create new cron job that calls Edge Function via HTTP POST
   - Schedule: Daily at 9:00 AM EST

### Option B: Edge Function Not Deployed
**If the cron job is correct but Edge Function is missing:**

1. Check if Edge Function exists: `supabase/functions/send-daily-agenda-email/`
2. Deploy it:
   ```bash
   supabase functions deploy send-daily-agenda-email
   ```

### Option C: Email Settings Not Configured
**If everything is set up but no recipients:**

1. Admin needs to configure who receives emails in App Settings → Daily Agenda Email
2. Toggle on users who should receive the daily email

## 📋 Verification Checklist

After applying fixes:

- [ ] Run `CHECK_CURRENT_CRON_COMMAND.sql` - verify command uses `http(...)` call
- [ ] Check cron job history: 
  ```sql
  SELECT * FROM cron.job_run_details 
  WHERE jobid = 2 
  ORDER BY start_time DESC LIMIT 5;
  ```
- [ ] Verify at least one user has `daily_email_settings.enabled = true`
- [ ] Test manually by uncommenting test section in `FIX_DAILY_AGENDA_CRON_JOB.sql`
- [ ] Check email was received by enabled recipients
- [ ] Monitor next scheduled run (tomorrow at 9:00 AM EST)

## 🎯 Expected Behavior

When working correctly:

1. **Daily at 9:00 AM EST** (2:00 PM UTC):
   - Cron job executes
   - Makes HTTP POST to Edge Function
   - Edge Function queries `daily_email_settings` for enabled recipients
   - Generates agenda (jobs for today/tomorrow)
   - Sends email to each enabled recipient
   - Returns success/failure status

2. **Cron Job Log Shows**:
   - Status: "succeeded"
   - Return message: Success message from Edge Function (as JSON)
   - Execution time: Usually 1-3 seconds

3. **Recipients Receive**:
   - Email titled "Daily Agenda for [Date]"
   - List of today's jobs
   - List of tomorrow's jobs
   - Sent to their profile email address

## 🚨 Troubleshooting

### If Dec 5 error happens again:
**Error**: `invalid input syntax for type json - Token "<" is invalid`

**Cause**: Edge Function returned HTML (probably error page) instead of JSON

**Solutions**:
1. Check Edge Function logs in Supabase Dashboard
2. Verify service role key is correct and active
3. Ensure Edge Function URL is correct
4. Test Edge Function manually via curl:
   ```bash
   curl -X POST https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"action":"send_daily_email","manual":false}'
   ```

### If emails not being sent:
1. Check `daily_email_settings` has enabled users
2. Verify Edge Function has email sending logic
3. Check email service credentials (Resend API key, etc.)
4. Look for errors in Edge Function logs

## 📝 Next Actions

1. **IMMEDIATE**: Run `CHECK_CURRENT_CRON_COMMAND.sql` and share results
2. **IF NEEDED**: Apply `FIX_DAILY_AGENDA_CRON_JOB.sql` migration
3. **VERIFY**: Test manually and check results
4. **MONITOR**: Watch tomorrow's scheduled run at 9:00 AM EST

---

**Status**: 🟡 Awaiting investigation results from Step 1
**Last Updated**: December 11, 2025
