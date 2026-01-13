# Daily Agenda Email Feature - Implementation Complete

## Overview
This feature allows admin and management users to receive automated daily email summaries of scheduled jobs. Emails are sent at 5:00 AM ET every day and include job counts and details formatted similar to the calendar day view.

## Files Created/Modified

### 1. Database Migration
**File:** `supabase/migrations/20251123000001_daily_agenda_email_settings.sql`
- Creates `daily_email_settings` table
- Stores user preferences for receiving daily emails
- RLS policies ensure only admins can manage settings

### 2. React Component
**File:** `src/components/DailyAgendaEmailSettings.tsx`
- User interface for managing email recipients
- Test email functionality (single or all recipients)
- Toggle switches for enabling/disabling per user
- Dark mode support

### 3. Admin Settings Integration
**File:** `src/components/AppSettings.tsx` (Modified)
- Added "Daily Agenda Emails" button in Admin Settings
- Imports and conditionally displays `DailyAgendaEmailSettings` component

### 4. Edge Function
**File:** `supabase/functions/send-daily-agenda-email/index.ts`
- Fetches jobs for specified date
- Generates HTML email with job summary
- Sends to single recipient or all enabled users
- Uses existing `send-email` Edge Function

## Setup Instructions

### Step 1: Run Database Migration

```bash
# Connect to your Supabase project
npx supabase db push

# Or manually run the migration file in Supabase SQL Editor:
# Copy contents of: supabase/migrations/20251123000001_daily_agenda_email_settings.sql
```

### Step 2: Deploy Edge Function

```bash
# Deploy the new Edge Function
supabase functions deploy send-daily-agenda-email --project-ref YOUR_PROJECT_REF

# Verify deployment
supabase functions list
```

### Step 3: Set Up Cron Job (Supabase Cron Extension)

Option A: Using Supabase pg_cron

```sql
-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily email at 5:00 AM ET (9:00 AM UTC in EST, 10:00 AM UTC in EDT)
-- Note: Adjust for daylight saving time
SELECT cron.schedule(
  'daily-agenda-email',
  '0 9 * * *',  -- 9:00 AM UTC = 5:00 AM EST (adjust to 10 for EDT)
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-daily-agenda-email',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('mode', 'all', 'test', false)
  ) as request_id;
  $$
);
```

Option B: External Cron Service (GitHub Actions, etc.)

```yaml
# .github/workflows/daily-email.yml
name: Send Daily Agenda Email
on:
  schedule:
    - cron: '0 9 * * *'  # 9:00 AM UTC = 5:00 AM EST
  workflow_dispatch:  # Allow manual trigger

jobs:
  send-email:
    runs-on: ubuntu-latest
    steps:
      - name: Send Daily Email
        run: |
          curl -X POST \
            https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-daily-agenda-email \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"mode":"all","test":false}'
```

## Usage Guide

### For Administrators

#### 1. Access Settings
1. Navigate to **Dashboard → Settings** (Admin Settings)
2. Click **Daily Agenda Emails** button
3. Settings panel will expand below

#### 2. Enable/Disable Users
- View list of all admin and management users
- Toggle switch on/off for each user
- Changes save automatically
- Green toast confirmation appears

#### 3. Send Test Email

**Single Recipient:**
1. Select "Send to single test email"
2. Enter test email address
3. Click "Send Test Email Now"
4. Check inbox for email with today's jobs

**All Recipients:**
1. Select "Send to all enabled users"
2. See count of recipients
3. Click "Send Test Email Now"
4. All enabled users receive test email

### Email Format

The email includes:

**Header:**
- Day and date (e.g., "Friday, November 21, 2025")

**Summary Section:**
- Paint job count (blue)
- Callback job count (orange)
- Repair job count (red)
- Total job count (purple)

**Job Cards:**
Each job displays:
- Work order number
- Property name
- Unit number
- Assigned technician
- Job type
- "Job Request" badge

**Footer:**
- Timestamp of when email was sent

## API Reference

### Edge Function: `send-daily-agenda-email`

**Endpoint:** `POST /functions/v1/send-daily-agenda-email`

**Request Body:**
```json
{
  "mode": "single" | "all",
  "recipient": "test@example.com",  // Required if mode is "single"
  "test": true | false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully sent 3 email(s)",
  "sent": 3,
  "failed": 0,
  "summary": {
    "paint": 3,
    "callback": 1,
    "repair": 0,
    "total": 4
  },
  "totalJobs": 4
}
```

## Database Schema

### Table: `daily_email_settings`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | References auth.users(id) |
| `enabled` | boolean | Whether daily email is enabled |
| `created_at` | timestamptz | Record creation time |
| `updated_at` | timestamptz | Last update time |

**Indexes:**
- `idx_daily_email_settings_user_id` on `user_id`
- `idx_daily_email_settings_enabled` on `enabled` WHERE `enabled = true`

**RLS Policies:**
- Admin-only access for all operations (SELECT, INSERT, UPDATE, DELETE)

## Testing Checklist

- [ ] Database migration applied successfully
- [ ] Edge function deployed without errors
- [ ] Can access Daily Agenda Emails settings in Admin Settings
- [ ] Can toggle email settings for users
- [ ] Can send test email to single recipient
- [ ] Can send test email to all enabled users
- [ ] Email displays correctly in various email clients
- [ ] Email shows correct job counts
- [ ] Email shows correct job details
- [ ] Dark mode works in settings UI
- [ ] Cron job scheduled and running at 5:00 AM ET
- [ ] Daily emails being received by enabled users

## Troubleshooting

### No emails received
1. Check that user toggle is enabled in settings
2. Verify Edge Function is deployed: `supabase functions list`
3. Check Edge Function logs: `supabase functions logs send-daily-agenda-email`
4. Verify email configuration in send-email function
5. Check spam folder

### Test email fails
1. Verify user has admin role
2. Check browser console for errors
3. Verify Supabase connection
4. Test send-email function independently

### Wrong job counts
1. Verify jobs table has correct scheduled_date
2. Check timezone settings (should be America/New_York)
3. Review job_types table mappings
4. Check job status (cancelled jobs excluded)

### Cron not running
1. Verify pg_cron extension is enabled
2. Check cron schedule: `SELECT * FROM cron.job;`
3. Review cron job logs
4. Verify service role key is set correctly

## Future Enhancements

Potential improvements:
- [ ] Configurable send time per user
- [ ] Weekly summary option
- [ ] Job completion status in emails
- [ ] Email template customization
- [ ] Attachment support (PDF reports)
- [ ] Mobile-responsive email template
- [ ] Unsubscribe link in emails
- [ ] Email delivery analytics

## Support

For issues or questions:
1. Check Supabase dashboard logs
2. Review Edge Function logs
3. Verify database table exists and has data
4. Ensure RLS policies are correct
5. Test manually via Supabase SQL Editor

---

**Implementation Date:** November 23, 2025
**Version:** 1.0.0
**Status:** ✅ Complete and Ready for Testing
