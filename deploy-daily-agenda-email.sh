#!/bin/bash

# Daily Agenda Email Feature - Quick Deploy Script
# Run this script to deploy all components

echo "🚀 Deploying Daily Agenda Email Feature..."
echo ""

# Step 1: Deploy Edge Function
echo "📤 Step 1: Deploying Edge Function..."
supabase functions deploy send-daily-agenda-email

if [ $? -eq 0 ]; then
    echo "✅ Edge Function deployed successfully"
else
    echo "❌ Edge Function deployment failed"
    exit 1
fi

echo ""

# Step 2: Apply Database Migration
echo "📊 Step 2: Applying database migration..."
echo "Please run the following SQL in your Supabase SQL Editor:"
echo ""
echo "File: supabase/migrations/20251123000001_daily_agenda_email_settings.sql"
echo ""
echo "Or push all migrations with:"
echo "  npx supabase db push"
echo ""

# Step 3: Instructions for Cron Setup
echo "⏰ Step 3: Set up Cron Job"
echo ""
echo "Run this SQL in Supabase SQL Editor to schedule daily emails at 5:00 AM ET:"
echo ""
echo "SELECT cron.schedule("
echo "  'daily-agenda-email',"
echo "  '0 9 * * *',  -- 9:00 AM UTC = 5:00 AM EST"
echo "  \$\$"
echo "  SELECT net.http_post("
echo "    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-daily-agenda-email',"
echo "    headers := jsonb_build_object("
echo "      'Authorization', 'Bearer ' || current_setting('app.service_role_key'),"
echo "      'Content-Type', 'application/json'"
echo "    ),"
echo "    body := jsonb_build_object('mode', 'all', 'test', false)"
echo "  ) as request_id;"
echo "  \$\$"
echo ");"
echo ""

# Step 4: Testing
echo "🧪 Step 4: Testing"
echo ""
echo "After deployment:"
echo "1. Navigate to Dashboard → Settings → Daily Agenda Emails"
echo "2. Enable email for at least one user"
echo "3. Click 'Send Test Email Now' to verify"
echo ""

echo "✅ Deployment script complete!"
echo ""
echo "📖 For detailed documentation, see: DAILY_AGENDA_EMAIL_IMPLEMENTATION.md"
