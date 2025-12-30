# Daily Agenda Email Fix Instructions

We have identified two issues preventing the daily emails from sending correctly:
1.  **Function Timeout Risk**: The Edge Function was trying to fetch the entire database of jobs. I have optimized it to only fetch jobs for the specific day.
2.  **Schedule Mismatch**: The cron job might be set to the wrong time (7:00 AM instead of 5:00 AM).

Please follow these steps to apply the fixes.

## Step 1: Deploy the Optimized Edge Function

The function code has been updated to be much faster and reliable. You need to deploy it to Supabase.

Run this command in your terminal:

```bash
supabase functions deploy send-daily-agenda-email
```

*Note: If you don't have the Supabase CLI installed locally, let me know, and I can guide you on how to update it via the dashboard.*

## Step 2: Fix Cron Schedule & Verify Settings

I have created a SQL script that will:
*   Update the cron schedule to **5:00 AM EST** (10:00 UTC).
*   Preserve your existing authentication keys.
*   Check if you have any enabled recipients.

1.  Open the **Supabase Dashboard**.
2.  Go to the **SQL Editor**.
3.  Open (or copy/paste content from) `FIX_DAILY_EMAIL_SCHEDULE_AND_CHECK.sql`.
4.  Click **Run**.

## Step 3: Check the Results

After running the SQL script, look at the "Results" panel:
1.  **Schedule**: Ensure `schedule` is `0 10 * * *`.
2.  **Recipients**: Ensure at least one user is listed in the recipients table. **If the list is empty, no emails will be sent.**
    *   To fix this, go to your App's **Admin Settings > Daily Agenda Email** and toggle ON the users.

## Step 4: Test Manually

You can trigger a manual test from the Admin Settings page to confirm the email sends correctly with the new function code.
