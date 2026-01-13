# Daily Agenda Email Cron Setup Guide

**Date**: November 24, 2025  
**Status**: ⚠️ Action Required

---

## ⚠️ Issue Identified

The daily agenda email feature was deployed but **automatic scheduling was not set up**. The Edge Function exists and works, but needs a trigger to run daily.

---

## 📋 Three Setup Options

### Option 1: Supabase Database Webhooks (Recommended - Easiest)

**Best for**: Projects already on Supabase with webhook support

1. Go to Supabase Dashboard → Database → Webhooks
2. Click "Create a new webhook"
3. Configure:
   - **Name**: `daily-agenda-email-trigger`
   - **Table**: `daily_agenda_email_settings`
   - **Events**: None (we'll use scheduled trigger)
   - **Method**: Custom Schedule
   - **Schedule**: Cron expression based on settings
   - **URL**: `https://[your-project].supabase.co/functions/v1/send-daily-agenda-email`
   - **Headers**:
     ```
     Authorization: Bearer [YOUR_SERVICE_ROLE_KEY]
     Content-Type: application/json
     ```
   - **Body**:
     ```json
     {
       "action": "send_daily_email",
       "manual": false
     }
     ```

### Option 2: GitHub Actions (Recommended - Most Reliable)

**Best for**: Projects already using GitHub

1. Create `.github/workflows/daily-email.yml`:

```yaml
name: Send Daily Agenda Email

on:
  schedule:
    # Runs at 7:00 AM ET (11:00 AM UTC) every day
    - cron: '0 11 * * *'
  workflow_dispatch: # Allows manual trigger

jobs:
  send-email:
    runs-on: ubuntu-latest
    steps:
      - name: Send Daily Email
        run: |
          curl -X POST \
            'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email' \
            -H 'Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}' \
            -H 'Content-Type: application/json' \
            -d '{
              "action": "send_daily_email",
              "manual": false
            }'
```

2. Add Secret to GitHub:
   - Go to Repository Settings → Secrets → Actions
   - Add `SUPABASE_SERVICE_ROLE_KEY` with your service role key

3. Adjust cron time based on email settings

### Option 3: Vercel Cron Jobs

**Best for**: Projects deployed on Vercel

1. Create `api/send-daily-email.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Verify this is from Vercel Cron
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const response = await fetch(
      `https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send_daily_email',
          manual: false,
        }),
      }
    );

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error sending daily email:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
```

2. Create `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/send-daily-email",
    "schedule": "0 11 * * *"
  }]
}
```

3. Add environment variables in Vercel dashboard:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` (generate a random string)

### Option 4: pg_cron (If Available)

**Best for**: Supabase Pro plans with pg_cron enabled

Run the migration we created:

```bash
npx supabase migration up --file 20251124000001_daily_email_cron_job.sql
```

This will:
- Enable pg_cron extension (if available)
- Create helper functions
- Schedule the daily job
- Create logging table

---

## 🔧 Quick Fix for Testing

### Manual Trigger (Works Immediately)

You can test the email sending manually:

```bash
curl -X POST \
  'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email' \
  -H 'Authorization: Bearer YOUR_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "send_daily_email",
    "manual": true
  }'
```

### Via Supabase SQL Editor

```sql
-- Check current settings
SELECT * FROM daily_agenda_email_settings;

-- Test the helper function (if migration was run)
SELECT check_and_send_daily_email();
```

---

## 📊 Verify Setup

### Check if pg_cron is Available

```sql
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

### Check Scheduled Jobs (if pg_cron is available)

```sql
SELECT * FROM cron.job WHERE jobname = 'daily-agenda-email-job';
```

### Check Email Send History (if migration was run)

```sql
SELECT * FROM daily_email_send_log ORDER BY sent_at DESC LIMIT 10;
```

---

## 🎯 Recommended Approach

Based on your setup, I recommend:

1. **If you're already using GitHub**: Use **Option 2 (GitHub Actions)**
   - Most reliable
   - Easy to debug
   - Free on GitHub
   - Can see logs in Actions tab

2. **If you're on Vercel**: Use **Option 3 (Vercel Cron)**
   - Native integration
   - No external dependencies
   - Automatic scaling

3. **If neither**: Use **Option 2 (GitHub Actions)** anyway
   - Create a separate repo just for cron jobs
   - Or use Option 1 if Supabase supports it

---

## ⏰ Timezone Considerations

The email settings store the send time in Eastern Time (America/New_York). When setting up cron:

### Converting ET to UTC

- **5:00 AM ET** = 9:00 AM UTC (Standard Time) or 10:00 AM UTC (Daylight Time)
- **6:00 AM ET** = 10:00 AM UTC (Standard Time) or 11:00 AM UTC (Daylight Time)
- **7:00 AM ET** = 11:00 AM UTC (Standard Time) or 12:00 PM UTC (Daylight Time)

### Cron Expressions

```
0 9 * * 1-5    # 9:00 AM UTC, Mon-Fri = 5:00 AM ET weekdays (Standard Time)
0 10 * * 1-5   # 10:00 AM UTC, Mon-Fri = 5:00 AM ET weekdays (Daylight Time)
0 11 * * *     # 11:00 AM UTC, Daily = 7:00 AM ET (during Standard Time)
```

**Note**: The Edge Function handles timezone conversion automatically, so cron just needs to trigger at the right UTC time.

---

## 🚀 Quick Start - GitHub Actions (5 Minutes)

1. **Create Workflow File**

```bash
mkdir -p .github/workflows
cat > .github/workflows/daily-email.yml << 'EOF'
name: Send Daily Agenda Email

on:
  schedule:
    - cron: '0 9 * * 1-5'  # 5 AM ET on weekdays (Mon-Fri) during standard time
  workflow_dispatch:

jobs:
  send-email:
    runs-on: ubuntu-latest
    steps:
      - name: Send Daily Email
        run: |
          curl -X POST \
            'https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-daily-agenda-email' \
            -H 'Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}' \
            -H 'Content-Type: application/json' \
            -d '{"action": "send_daily_email", "manual": false}'
EOF
```

2. **Add Secret to GitHub**
   - Go to repo Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `SUPABASE_SERVICE_ROLE_KEY`
   - Value: Your service role key from Supabase dashboard

3. **Test It**
   - Go to Actions tab
   - Click "Send Daily Agenda Email"
   - Click "Run workflow"
   - Check if email was sent

4. **Commit and Push**

```bash
git add .github/workflows/daily-email.yml
git commit -m "Add automated daily email scheduling"
git push origin main
```

**Done!** Email will now send automatically every weekday morning at 5 AM ET (Monday-Friday only).

---

## 📝 Migration Status

The migration file `20251124000001_daily_email_cron_job.sql` has been created but needs to be applied:

```bash
# Apply the migration
cd "/Users/timothyfarzalo/Desktop/jg-3-june-2025-main-main - September 2025"
npx supabase db push

# Or apply specific migration
npx supabase migration up
```

This will:
- ✅ Create `check_and_send_daily_email()` function
- ✅ Create `daily_email_send_log` table
- ✅ Attempt to schedule pg_cron job (if available)

---

## 🔍 Troubleshooting

### Email Not Sending

1. **Check if daily email is enabled**:
   ```sql
   SELECT * FROM daily_agenda_email_settings;
   ```

2. **Check Edge Function logs** in Supabase Dashboard

3. **Verify cron is running**:
   - GitHub Actions: Check Actions tab
   - Vercel: Check Function logs
   - pg_cron: Query `cron.job_run_details`

4. **Test manually** using curl command above

### Wrong Send Time

1. Check timezone conversion (ET → UTC)
2. Adjust cron expression
3. Verify `send_time` in settings table

### No Jobs in Email

1. Check if jobs exist for tomorrow's date
2. Verify job status is not 'cancelled'
3. Check Edge Function logs for SQL errors

---

## ✅ Next Steps

1. **Choose a scheduling option** (GitHub Actions recommended)
2. **Apply the database migration**
3. **Set up the scheduled job**
4. **Test with manual trigger**
5. **Monitor first automated send**

---

## 📞 Support

If you need help:
1. Check Edge Function logs in Supabase Dashboard
2. Check cron job logs (GitHub Actions/Vercel/etc.)
3. Review `daily_email_send_log` table for history
4. Test manually first before troubleshooting automation

---

**Status**: ⚠️ **Action Required - Choose and implement a scheduling option**  
**Priority**: Medium (Feature is deployed but not automated)  
**Estimated Setup Time**: 5-10 minutes
