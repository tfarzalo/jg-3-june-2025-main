#!/bin/bash

echo "🚀 JG Painting Pros - Calendar Feed Deployment"
echo "=============================================="
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found"
    echo "Install it with: brew install supabase/tap/supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Check if we're in the right directory
if [ ! -f "supabase/functions/calendar-feed/index.ts" ]; then
    echo "❌ calendar-feed function not found"
    echo "Make sure you're in the project root directory"
    exit 1
fi

echo "✅ Calendar feed function found"
echo ""

# Show current function content size
LINES=$(wc -l < supabase/functions/calendar-feed/index.ts)
echo "📄 Current function: $LINES lines"
echo ""

# Ask for confirmation
read -p "Deploy calendar-feed to Supabase? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "�� Deploying calendar-feed function..."
echo ""

# Deploy the function (with --no-verify-jwt to allow unauthenticated calendar app access)
supabase functions deploy calendar-feed --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "Next steps:"
    echo "1. Test the feeds in your application"
    echo "2. Click 'Subscribe to Calendars'"
    echo "3. Try the Apple Calendar and Google Calendar links"
    echo ""
    echo "Feed URL format:"
    echo "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/calendar-feed?scope=events&token=YOUR_TOKEN"
else
    echo ""
    echo "❌ Deployment failed"
    echo "Check the error message above"
    exit 1
fi
