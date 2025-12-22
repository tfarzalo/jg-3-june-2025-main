# Troubleshooting Daily Agenda Email Test Failure

## Steps to Debug

### 1. Check Edge Function Logs

1. Go to Supabase Dashboard → Edge Functions
2. Click on `send-daily-agenda-email` 
3. Click "Logs" tab
4. Look for the most recent error (should be from when you clicked "Send Test Email")

Look for:
- HTTP status code (500, 400, etc.)
- Error messages
- Stack traces
- What step failed

### 2. Check What Request Was Sent

The frontend sends this payload when you click "Send Test Email":
```typescript
{
  mode: 'test',
  emails: ['email1@example.com', 'email2@example.com', ...]
}
```

### 3. Common Issues

**Issue 1: No jobs for today**
- The function might be trying to fetch jobs for today
- If there are no jobs scheduled, it might return an error
- Check: `SELECT * FROM jobs WHERE DATE(job_date) = CURRENT_DATE`

**Issue 2: Email sending function failure**
- The daily agenda function calls another function to send email
- That secondary call might be failing
- Check logs for both `send-daily-agenda-email` AND `send-email` functions

**Issue 3: Missing email settings**
- Daily email settings might not be saved in database
- Check: `SELECT * FROM daily_email_settings LIMIT 1`

**Issue 4: Invalid recipient email format**
- One of the emails in the list might be malformed
- Frontend validation might have missed it

### 4. What to Share

Please check the Edge Function logs and share:
1. The exact error message
2. HTTP status code
3. Which line/function is failing
4. Any relevant error details

This will help me pinpoint the exact issue!
