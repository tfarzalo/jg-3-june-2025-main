#!/bin/bash
# Fix Zoho Email Authentication
# Run this script to update your Zoho credentials in Supabase

echo "=================================================="
echo "🔧 Zoho Email Credential Update Tool"
echo "=================================================="
echo ""
echo "This script will update your Zoho SMTP credentials in Supabase."
echo ""
echo "⚠️  IMPORTANT: You need a Zoho App-Specific Password"
echo "   (NOT your regular Zoho login password)"
echo ""
echo "📋 To generate an App-Specific Password:"
echo "   1. Go to https://mail.zoho.com"
echo "   2. Click Profile → My Account → Security"
echo "   3. Find 'App Passwords' section"
echo "   4. Click 'Generate New Password'"
echo "   5. Name it: 'JG Painting Pros SMTP'"
echo "   6. Copy the generated password"
echo ""
read -p "Press Enter when you have your app-specific password ready..."
echo ""

# Get credentials
echo "Enter your Zoho email address (e.g., name@zohomail.com):"
read ZOHO_EMAIL

echo ""
echo "Enter your Zoho App-Specific Password (will be hidden):"
read -s ZOHO_PASSWORD
echo ""

# Confirm
echo ""
echo "📧 Email: $ZOHO_EMAIL"
echo "🔑 Password: [hidden]"
echo ""
read -p "Is this correct? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "❌ Aborted. Run the script again to retry."
    exit 1
fi

echo ""
echo "🔄 Updating Supabase secrets..."
echo ""

# Update secrets
npx supabase secrets set ZOHO_EMAIL="$ZOHO_EMAIL"
npx supabase secrets set ZOHO_PASSWORD="$ZOHO_PASSWORD"
npx supabase secrets set ZOHO_SMTP_HOST="smtp.zoho.com"
npx supabase secrets set ZOHO_SMTP_PORT="587"

echo ""
echo "✅ Credentials updated successfully!"
echo ""
echo "🧪 Testing email function..."
echo ""

# Test the function
RESPONSE=$(curl -s -X GET "https://tbwtfimnbmvbgesidbxh.supabase.co/functions/v1/send-email" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqcHRscHBwZnV6aWVicXptZ3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgxNDE3MjAsImV4cCI6MjAzMzcxNzcyMH0.u5C-c_UQAEMFx84qlLjB7AkYm50F62L_MFsPJxsyTNI")

echo "$RESPONSE" | jq .

if echo "$RESPONSE" | jq -e '.env_check.ZOHO_EMAIL == "SET"' > /dev/null 2>&1; then
    echo ""
    echo "✅ Email function can see credentials!"
    echo ""
    echo "🎯 Next Steps:"
    echo "   1. Try submitting a support ticket again"
    echo "   2. Check design@thunderlightmedia.com for the email"
    echo "   3. If still failing, wait 1-2 minutes for secrets to propagate"
    echo ""
else
    echo ""
    echo "⚠️  Warning: Function may need time to pick up new credentials"
    echo "   Wait 1-2 minutes and try again"
    echo ""
fi

echo "=================================================="
echo "Done! Email system should be working now."
echo "=================================================="
