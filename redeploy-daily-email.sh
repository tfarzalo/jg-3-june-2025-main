#!/bin/bash

# Quick redeploy script for daily agenda email function
# Run this after fixing the email connection

echo "🔄 Redeploying send-daily-agenda-email Edge Function..."
echo ""

supabase functions deploy send-daily-agenda-email

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Function redeployed successfully!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Go to Settings → Daily Agenda Emails"
    echo "2. Click 'Send Test Email Now'"
    echo "3. Check your inbox"
    echo ""
    echo "📊 View logs with:"
    echo "   supabase functions logs send-daily-agenda-email"
else
    echo ""
    echo "❌ Deployment failed. Please check your Supabase CLI configuration."
    exit 1
fi
